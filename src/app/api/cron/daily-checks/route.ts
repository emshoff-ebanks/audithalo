import { NextResponse } from "next/server";
import { and, eq, lt, sql } from "drizzle-orm";
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
  //   Find every supervisee membership older than 24h whose org has no
  //   rule_assignment row. Notify the inviter (mapped via the original
  //   invitation row) — once per 7 days per (supervisor, supervisee).
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
  let notSetEmitted = 0;

  for (const c of ruleNotSet) {
    // Find the inviting supervisor via the accepted invitation row.
    const invite = await db.query.invitations.findFirst({
      where: and(
        eq(schema.invitations.orgId, c.orgId),
        eq(schema.invitations.email, c.superviseeEmail),
        eq(schema.invitations.role, "supervisee")
      ),
    });
    const inviterId = invite?.invitedById;
    if (!inviterId) continue;

    // De-dup: skip if we've notified this supervisor about this supervisee
    // within the last 7 days.
    const dupCheck = await db.execute(sql`
      SELECT 1
      FROM notifications
      WHERE user_id = ${inviterId}
        AND kind = 'supervisor_rule_not_set'
        AND created_at >= ${sevenDaysAgo.toISOString()}
        AND payload->>'superviseeId' = ${c.superviseeId}
      LIMIT 1
    `);
    if ((dupCheck as unknown as { rows: unknown[] }).rows.length > 0) continue;

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
