import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

/**
 * Daily cron: surface compliance gaps that no event-driven trigger covers.
 *
 *   Pass 1 — supervisor_rule_not_set: invite was accepted >24h ago and the
 *            supervisee still has no rule assignment. De-dup by only emitting
 *            once per 7 days per (supervisor, supervisee) pair.
 *
 *   Pass 2 — attestation_overdue: a future hook for surfacing blocker-severity
 *            gaps that have been open >7 days. Skipped in v1 because the
 *            rule-engine is per-render and a per-cron evaluation would need
 *            persisted gap history we haven't built yet.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, reason: "CRON_SECRET not set — refusing to run" },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();
  const dayAgo = new Date(now.getTime() - ONE_DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

  // Pass 1: supervisor_rule_not_set
  //
  // Query 1: find every supervisee membership > 24h old with no rule
  // assignment yet. Single left-join; null ruleId after join = no assignment.
  const candidates = await db
    .select({
      orgId: schema.orgMemberships.orgId,
      superviseeId: schema.orgMemberships.userId,
      superviseeEmail: schema.users.email,
      superviseeName: schema.users.name,
      ruleId: schema.superviseeRuleAssignments.ruleId,
    })
    .from(schema.orgMemberships)
    .innerJoin(
      schema.users,
      eq(schema.users.id, schema.orgMemberships.userId)
    )
    .leftJoin(
      schema.superviseeRuleAssignments,
      and(
        eq(
          schema.superviseeRuleAssignments.superviseeId,
          schema.orgMemberships.userId
        ),
        eq(
          schema.superviseeRuleAssignments.orgId,
          schema.orgMemberships.orgId
        )
      )
    )
    .where(
      and(
        eq(schema.orgMemberships.role, "supervisee"),
        lt(schema.orgMemberships.createdAt, dayAgo)
      )
    );

  const ruleNotSet = candidates.filter((c) => c.ruleId === null);
  if (ruleNotSet.length === 0) {
    return NextResponse.json({
      ok: true,
      runAt: now.toISOString(),
      pass1_supervisor_rule_not_set: { candidatesChecked: 0, emitted: 0 },
    });
  }

  // Query 2: batch-look up the most-recent ACCEPTED invitation per
  // (orgId, email) so we know which supervisor to notify. Picking the
  // latest accepted invite avoids duplicates from a re-invite cycle.
  const orgIds = Array.from(new Set(ruleNotSet.map((c) => c.orgId)));
  const emails = Array.from(new Set(ruleNotSet.map((c) => c.superviseeEmail)));
  const acceptedInvites = await db
    .select({
      orgId: schema.invitations.orgId,
      email: schema.invitations.email,
      invitedById: schema.invitations.invitedById,
      acceptedAt: schema.invitations.acceptedAt,
    })
    .from(schema.invitations)
    .where(
      and(
        inArray(schema.invitations.orgId, orgIds),
        inArray(schema.invitations.email, emails),
        eq(schema.invitations.role, "supervisee")
      )
    )
    .orderBy(desc(schema.invitations.acceptedAt));

  // Pick the latest accepted invite per (orgId, email).
  const inviterByKey = new Map<string, string>();
  for (const inv of acceptedInvites) {
    if (inv.acceptedAt === null) continue;
    const key = `${inv.orgId}|${inv.email}`;
    if (!inviterByKey.has(key)) {
      inviterByKey.set(key, inv.invitedById);
    }
  }

  // Query 3: batch-look up recent supervisor_rule_not_set notifications for
  // dedup. Filter to the union of inviter user IDs we're about to notify.
  const inviterIds = Array.from(new Set(inviterByKey.values()));
  const recentNotifs =
    inviterIds.length === 0
      ? []
      : await db
          .select({
            userId: schema.notifications.userId,
            payload: schema.notifications.payload,
          })
          .from(schema.notifications)
          .where(
            and(
              inArray(schema.notifications.userId, inviterIds),
              eq(schema.notifications.kind, "supervisor_rule_not_set"),
              gte(schema.notifications.createdAt, sevenDaysAgo)
            )
          );

  // Build dedup index: `${inviterId}|${superviseeId}`.
  const recentlyNotified = new Set<string>();
  for (const n of recentNotifs) {
    const payload = n.payload as { superviseeId?: string };
    if (payload?.superviseeId) {
      recentlyNotified.add(`${n.userId}|${payload.superviseeId}`);
    }
  }

  let notSetEmitted = 0;
  for (const c of ruleNotSet) {
    const inviterId = inviterByKey.get(`${c.orgId}|${c.superviseeEmail}`);
    if (!inviterId) continue;
    if (recentlyNotified.has(`${inviterId}|${c.superviseeId}`)) continue;

    try {
      await createNotification({
        userId: inviterId,
        kind: "supervisor_rule_not_set",
        payload: {
          superviseeId: c.superviseeId,
          superviseeName: c.superviseeName,
          superviseeEmail: c.superviseeEmail,
        },
      });
      // Stamp local index too so a duplicate candidate row in the same run
      // doesn't double-fire (defensive — shouldn't happen but cheap).
      recentlyNotified.add(`${inviterId}|${c.superviseeId}`);
      notSetEmitted += 1;
    } catch (err) {
      console.error("[cron] supervisor_rule_not_set createNotification:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    runAt: now.toISOString(),
    pass1_supervisor_rule_not_set: {
      candidatesChecked: ruleNotSet.length,
      emitted: notSetEmitted,
    },
  });
}
