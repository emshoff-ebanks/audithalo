import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db, schema } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { latestVersionForState, parseRuleId } from "@/lib/rules";

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
    pass5_no_show: { scanned: 0, flagged: 0, notified: 0 },
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
  // Pass 5 — session_no_show
  //
  // Any session_events row with scheduledStatus='scheduled' whose end time
  // is more than 24h in the past has crossed the no-show window per locked
  // decision #8 in docs/strategy/08-scheduling-and-calendar.md. Flag it +
  // notify the supervisor who logged it (or the assigned supervisor when
  // the actor was HR Admin scheduling on behalf).
  // -------------------------------------------------------------------------
  try {
    const noShowCutoff = new Date(now.getTime() - ONE_DAY_MS);
    const candidates = await db
      .select({
        id: schema.sessionEvents.id,
        orgId: schema.sessionEvents.orgId,
        superviseeId: schema.sessionEvents.superviseeId,
        loggedById: schema.sessionEvents.loggedById,
        date: schema.sessionEvents.date,
        durationHours: schema.sessionEvents.durationHours,
        timeZone: schema.sessionEvents.timeZone,
        superviseeName: schema.users.name,
        superviseeEmail: schema.users.email,
      })
      .from(schema.sessionEvents)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.sessionEvents.superviseeId)
      )
      .where(eq(schema.sessionEvents.scheduledStatus, "scheduled"));

    for (const row of candidates) {
      result.pass5_no_show.scanned += 1;
      const endMs =
        row.date.getTime() + Math.round(row.durationHours * 60 * 60_000);
      if (endMs > noShowCutoff.getTime()) continue; // still within window

      await db
        .update(schema.sessionEvents)
        .set({ scheduledStatus: "no_show" })
        .where(eq(schema.sessionEvents.id, row.id));
      result.pass5_no_show.flagged += 1;

      // Notify whichever supervisor is currently assigned. Falls back to
      // the original logger when no active assignment is found.
      let notifyUserId: string | null = null;
      const activeAssignment = await db.query.supervisorAssignments.findFirst(
        {
          where: and(
            eq(
              schema.supervisorAssignments.superviseeId,
              row.superviseeId
            ),
            eq(schema.supervisorAssignments.orgId, row.orgId),
            isNull(schema.supervisorAssignments.endedAt)
          ),
        }
      );
      notifyUserId = activeAssignment?.supervisorId ?? row.loggedById;

      const scheduledForLocal = row.timeZone
        ? new Intl.DateTimeFormat("en-US", {
            timeZone: row.timeZone,
            dateStyle: "medium",
            timeStyle: "short",
          }).format(row.date)
        : row.date.toISOString().slice(0, 16).replace("T", " ") + " UTC";

      try {
        await createNotification({
          userId: notifyUserId,
          kind: "session_no_show",
          payload: {
            sessionId: row.id,
            superviseeName: row.superviseeName ?? row.superviseeEmail,
            scheduledForLocal,
          },
        });
        result.pass5_no_show.notified += 1;
      } catch (err) {
        console.error("[cron] session_no_show notification failed:", err);
      }
    }
  } catch (err) {
    console.error("[cron] no-show pass failed:", err);
  }

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
