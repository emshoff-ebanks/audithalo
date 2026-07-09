import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db, schema } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { latestVersionForState, parseRuleId } from "@/lib/rules";
import { verifyCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sentry Cron monitor slug for /api/cron/daily-checks. If this monitor stops
 * checking in on its expected schedule, Sentry alerts us — catches the case
 * where the route silently 500s every morning (e.g. CRON_SECRET unset, Neon
 * outage, a runtime regression in an unrelated commit).
 *
 * Schedule mirrors vercel.json: "0 14 * * *" = 14:00 UTC daily (= 9am ET).
 */
const CRON_MONITOR_SLUG = "daily-checks";
const CRON_MONITOR_CONFIG = {
  schedule: { type: "crontab" as const, value: "0 14 * * *" },
  // Tolerance windows in minutes. 15min late start = ok; 30 min runtime = ok.
  // Vercel cron typically fires within ~60s of the scheduled time.
  checkinMargin: 15,
  maxRuntime: 30,
  timezone: "UTC",
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

/**
 * Daily cron: surface compliance facts that no event-driven trigger covers.
 *
 *   Pass 1 — supervisor_rule_not_set: invite was accepted >24h ago and the
 *            supervisee still has no rule assignment. Dedup: 7 days per
 *            (supervisor, supervisee) pair.
 *
 *   Pass 2 — rule_changed: an assignment's rule version is older than the
 *            latest available for its (jurisdiction, license) pair. If the
 *            supervisor's auto_apply_rule_updates is true, the assignment is
 *            bumped to the latest version and the notification is sent as a
 *            heads-up. Otherwise the notification asks them to apply.
 *            Dedup: skip if the assignment is snoozed within the last 30
 *            days, or if a rule_changed notification for this assignment +
 *            target version was already sent within the last 7 days.
 *
 *   Pass 3 — attestation_overdue: future hook for surfacing blocker-severity
 *            gaps that have been open >7 days. Skipped in v1.
 */
async function handleDailyChecks(request: Request) {
  const authFail = verifyCronAuth(request);
  if (authFail) return authFail;

  const now = new Date();
  const dayAgo = new Date(now.getTime() - ONE_DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

  const result = {
    ok: true,
    runAt: now.toISOString(),
    pass1_supervisor_rule_not_set: { candidatesChecked: 0, emitted: 0 },
    pass2_rule_changed: {
      assignmentsChecked: 0,
      stale: 0,
      autoApplied: 0,
      notified: 0,
    },
    pass3_trial_ending_soon: { orgsChecked: 0, notified: 0 },
    pass4_account_purge: { purged: 0 },
    // pass5_no_show removed 2026-06-15 — see comment further down.
  };

  // -------------------------------------------------------------------------
  // Pass 1 — supervisor_rule_not_set
  // -------------------------------------------------------------------------
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
  result.pass1_supervisor_rule_not_set.candidatesChecked = ruleNotSet.length;

  if (ruleNotSet.length > 0) {
    const orgIds = Array.from(new Set(ruleNotSet.map((c) => c.orgId)));
    const emails = Array.from(
      new Set(ruleNotSet.map((c) => c.superviseeEmail))
    );
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

    const inviterByKey = new Map<string, string>();
    for (const inv of acceptedInvites) {
      if (inv.acceptedAt === null) continue;
      const key = `${inv.orgId}|${inv.email}`;
      if (!inviterByKey.has(key)) inviterByKey.set(key, inv.invitedById);
    }

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

    const recentlyNotified = new Set<string>();
    for (const n of recentNotifs) {
      const payload = n.payload as { superviseeId?: string };
      if (payload?.superviseeId) {
        recentlyNotified.add(`${n.userId}|${payload.superviseeId}`);
      }
    }

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
        recentlyNotified.add(`${inviterId}|${c.superviseeId}`);
        result.pass1_supervisor_rule_not_set.emitted += 1;
      } catch (err) {
        console.error("[cron] supervisor_rule_not_set:", err);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 2 — rule_changed
  // -------------------------------------------------------------------------

  // Pull every assignment that isn't currently snoozed. Snoozed assignments
  // resume showing prompts once the snooze clock runs out (30 days).
  const assignments = await db
    .select({
      id: schema.superviseeRuleAssignments.id,
      orgId: schema.superviseeRuleAssignments.orgId,
      superviseeId: schema.superviseeRuleAssignments.superviseeId,
      ruleId: schema.superviseeRuleAssignments.ruleId,
      snoozedAt: schema.superviseeRuleAssignments.ruleChangeSnoozedAt,
    })
    .from(schema.superviseeRuleAssignments)
    .where(
      or(
        isNull(schema.superviseeRuleAssignments.ruleChangeSnoozedAt),
        lt(
          schema.superviseeRuleAssignments.ruleChangeSnoozedAt,
          thirtyDaysAgo
        )
      )
    );
  result.pass2_rule_changed.assignmentsChecked = assignments.length;

  // Identify the stale ones plus their org-owners (= the supervisor we'll
  // notify or auto-apply on behalf of).
  type StaleEntry = {
    assignmentId: string;
    orgId: string;
    superviseeId: string;
    oldRuleId: string;
    newRuleId: string;
    oldLabel: string;
    newLabel: string;
    snoozedAt: Date | null;
  };
  const stale: StaleEntry[] = [];
  for (const a of assignments) {
    if (!a.superviseeId) continue;
    const parsed = parseRuleId(a.ruleId);
    if (!parsed) continue;
    const latest = latestVersionForState(parsed.jurisdiction, parsed.licenseCode);
    if (latest === null || latest <= parsed.version) continue;
    // Mirror the convention from src/lib/rules/types.ts ruleId(): lowercase
    // "{jurisdiction}-{license_code}-v{version}".
    const newRuleId =
      `${parsed.jurisdiction}-${parsed.licenseCode}-v${latest}`.toLowerCase();
    stale.push({
      assignmentId: a.id,
      orgId: a.orgId,
      superviseeId: a.superviseeId,
      oldRuleId: a.ruleId,
      newRuleId,
      oldLabel: `${parsed.jurisdiction} ${parsed.licenseCode} v${parsed.version}`,
      newLabel: `${parsed.jurisdiction} ${parsed.licenseCode} v${latest}`,
      snoozedAt: a.snoozedAt,
    });
  }
  result.pass2_rule_changed.stale = stale.length;

  if (stale.length > 0) {
    // Pull the org → createdById map so we know which supervisor to notify.
    const orgIds = Array.from(new Set(stale.map((s) => s.orgId)));
    const orgs = await db
      .select({
        id: schema.organizations.id,
        createdById: schema.organizations.createdById,
      })
      .from(schema.organizations)
      .where(inArray(schema.organizations.id, orgIds));
    const supervisorByOrg = new Map<string, string>(
      orgs.map((o) => [o.id, o.createdById])
    );

    // Pull supervisor auto-apply prefs in one query.
    const supervisorIds = Array.from(new Set(supervisorByOrg.values()));
    const supervisorPrefs =
      supervisorIds.length === 0
        ? []
        : await db
            .select({
              id: schema.users.id,
              autoApply: schema.users.autoApplyRuleUpdates,
            })
            .from(schema.users)
            .where(inArray(schema.users.id, supervisorIds));
    const autoApplyByUser = new Map<string, boolean>(
      supervisorPrefs.map((u) => [u.id, u.autoApply])
    );

    // Dedup: pull recent rule_changed notifications keyed by (userId,
    // assignmentId, newRuleId) within the last 7 days.
    const recentNotifs =
      supervisorIds.length === 0
        ? []
        : await db
            .select({
              userId: schema.notifications.userId,
              payload: schema.notifications.payload,
            })
            .from(schema.notifications)
            .where(
              and(
                inArray(schema.notifications.userId, supervisorIds),
                eq(schema.notifications.kind, "rule_changed"),
                gte(schema.notifications.createdAt, sevenDaysAgo)
              )
            );
    const recentlyNotified = new Set<string>();
    for (const n of recentNotifs) {
      const payload = n.payload as {
        assignmentId?: string;
        newRuleId?: string;
      };
      if (payload?.assignmentId && payload?.newRuleId) {
        recentlyNotified.add(
          `${n.userId}|${payload.assignmentId}|${payload.newRuleId}`
        );
      }
    }

    for (const s of stale) {
      const supervisorId = supervisorByOrg.get(s.orgId);
      if (!supervisorId) continue;
      const dupKey = `${supervisorId}|${s.assignmentId}|${s.newRuleId}`;
      if (recentlyNotified.has(dupKey)) continue;

      const autoApply = autoApplyByUser.get(supervisorId) ?? false;
      if (autoApply) {
        try {
          await db
            .update(schema.superviseeRuleAssignments)
            .set({ ruleId: s.newRuleId, ruleChangeSnoozedAt: null })
            .where(eq(schema.superviseeRuleAssignments.id, s.assignmentId));
          result.pass2_rule_changed.autoApplied += 1;
        } catch (err) {
          console.error("[cron] rule auto-apply failed:", err);
          continue;
        }
      }

      try {
        await createNotification({
          userId: supervisorId,
          kind: "rule_changed",
          payload: {
            assignmentId: s.assignmentId,
            superviseeId: s.superviseeId,
            oldRuleId: s.oldRuleId,
            newRuleId: s.newRuleId,
            oldRuleLabel: s.oldLabel,
            newRuleLabel: s.newLabel,
            autoApplied: autoApply,
          },
        });
        recentlyNotified.add(dupKey);
        result.pass2_rule_changed.notified += 1;
      } catch (err) {
        console.error("[cron] rule_changed notification failed:", err);
      }
    }

  }

  // -------------------------------------------------------------------------
  // Pass 3 — trial_ending_soon
  //
  // Find orgs in trialing status whose subscription_period_end falls in the
  // T-3-days window (between 2.5 and 3.5 days from now), notify the org
  // owner once. Dedup: skip if a trial_ending_soon notification went out for
  // this org within the last 6 days.
  // -------------------------------------------------------------------------
  const t3Lower = new Date(now.getTime() + 2.5 * ONE_DAY_MS);
  const t3Upper = new Date(now.getTime() + 3.5 * ONE_DAY_MS);
  const sixDaysAgo = new Date(now.getTime() - 6 * ONE_DAY_MS);

  const trialingOrgs = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      ownerId: schema.organizations.createdById,
      periodEnd: schema.organizations.subscriptionPeriodEnd,
    })
    .from(schema.organizations)
    .where(
      and(
        eq(schema.organizations.subscriptionStatus, "trialing"),
        gte(schema.organizations.subscriptionPeriodEnd, t3Lower),
        lt(schema.organizations.subscriptionPeriodEnd, t3Upper)
      )
    );
  result.pass3_trial_ending_soon.orgsChecked = trialingOrgs.length;

  if (trialingOrgs.length > 0) {
    const ownerIds = Array.from(new Set(trialingOrgs.map((o) => o.ownerId)));
    const recentTrialNotifs = await db
      .select({
        userId: schema.notifications.userId,
        payload: schema.notifications.payload,
      })
      .from(schema.notifications)
      .where(
        and(
          inArray(schema.notifications.userId, ownerIds),
          eq(schema.notifications.kind, "trial_ending_soon"),
          gte(schema.notifications.createdAt, sixDaysAgo)
        )
      );
    const recentlyNotified = new Set<string>();
    for (const n of recentTrialNotifs) {
      const payload = n.payload as { orgId?: string };
      if (payload?.orgId) {
        recentlyNotified.add(`${n.userId}|${payload.orgId}`);
      }
    }

    for (const org of trialingOrgs) {
      if (recentlyNotified.has(`${org.ownerId}|${org.id}`)) continue;
      if (!org.periodEnd) continue;
      const msLeft = org.periodEnd.getTime() - now.getTime();
      const daysLeft = Math.max(1, Math.round(msLeft / ONE_DAY_MS));
      try {
        await createNotification({
          userId: org.ownerId,
          kind: "trial_ending_soon",
          payload: {
            orgId: org.id,
            orgName: org.name,
            daysLeft,
            trialEndsAt: org.periodEnd.toISOString().slice(0, 10),
          },
        });
        result.pass3_trial_ending_soon.notified += 1;
      } catch (err) {
        console.error("[cron] trial_ending_soon notification failed:", err);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 4 — account purge
  //
  // Permanently delete users whose deleted_at is more than 30 days ago.
  // The ON DELETE CASCADE foreign keys on org_memberships, session_events,
  // notifications, etc. take care of the children.
  // -------------------------------------------------------------------------
  try {
    const purged = await db
      .delete(schema.users)
      .where(lt(schema.users.deletedAt, thirtyDaysAgo))
      .returning({ id: schema.users.id });
    result.pass4_account_purge.purged = purged.length;
  } catch (err) {
    console.error("[cron] account purge failed:", err);
  }

  // -------------------------------------------------------------------------
  // Pass 5 — session_no_show — REMOVED 2026-06-15.
  //
  // The automatic 24h-after-end no-show flip lived here. It produced false
  // positives whenever a session DID happen but the supervisor hadn't
  // signed within the window (which is most of the time — supervisors sign
  // when they get to their inbox, not on a 24h clock). Replaced with
  // /api/cron/sign-reminders, which only nudges and never claims that a
  // session was a no-show. The only path to scheduledStatus='no_show' is
  // now a human clicking "This didn't happen" on the sign screen.
  //
  // See docs/strategy/08-scheduling-and-calendar.md §"Sign reminders".
  // -------------------------------------------------------------------------

  return NextResponse.json(result);
}

/**
 * Public GET handler — wraps the real worker in Sentry.withMonitor so we
 * get a green tick in the Sentry Crons UI on every successful run and an
 * alert if a scheduled run is missed entirely or runs over budget.
 */
export const GET = (request: Request) =>
  Sentry.withMonitor(
    CRON_MONITOR_SLUG,
    () => handleDailyChecks(request),
    CRON_MONITOR_CONFIG
  );
