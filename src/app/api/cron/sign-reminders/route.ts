/**
 * Sign-reminder cron.
 *
 * Scans `session_events` every poll cycle for sessions whose scheduled end
 * time just passed and still need a signature. Fires one notification per
 * match, then stamps `signReminderSentAt` so subsequent polls skip the
 * row. Replaces the daily-checks Pass 5 auto-no-show flip — the only path
 * to `no_show` after this change is a human clicking "This didn't
 * happen" on the sign screen.
 *
 * Schedule lives in `.github/workflows/sign-reminders.yml` (every 10
 * minutes). Hits this endpoint with `Authorization: Bearer ${CRON_SECRET}`
 * so the URL alone isn't enough to trigger noise.
 *
 * See docs/strategy/08-scheduling-and-calendar.md §"Sign reminders".
 */

import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How far back the cron looks for "just ended" sessions. Set comfortably
 *  larger than the cron's interval so a missed run doesn't drop reminders
 *  on the floor. 30 min lets us tolerate a 20-min hiccup in GitHub
 *  Actions without losing notifications. */
const REMINDER_WINDOW_MS = 30 * 60 * 1000;

async function handle(request: Request) {
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
  const windowStart = new Date(now.getTime() - REMINDER_WINDOW_MS);

  // Drizzle's column expressions inside arithmetic need raw SQL because
  // duration_hours is real and we have to add it to date as an interval.
  // Postgres computes `date + (duration_hours * interval '1 hour')` row
  // by row, which we then compare against now() for "end time passed"
  // and against windowStart for "in the last window".
  const candidates = await db
    .select({
      id: schema.sessionEvents.id,
      orgId: schema.sessionEvents.orgId,
      superviseeId: schema.sessionEvents.superviseeId,
      loggedById: schema.sessionEvents.loggedById,
      date: schema.sessionEvents.date,
      durationHours: schema.sessionEvents.durationHours,
      sessionType: schema.sessionEvents.sessionType,
      timeZone: schema.sessionEvents.timeZone,
      superviseeName: schema.users.name,
      superviseeEmail: schema.users.email,
    })
    .from(schema.sessionEvents)
    .innerJoin(
      schema.users,
      eq(schema.users.id, schema.sessionEvents.superviseeId)
    )
    .where(
      and(
        eq(schema.sessionEvents.scheduledStatus, "scheduled"),
        isNull(schema.sessionEvents.signedAt),
        isNull(schema.sessionEvents.signReminderSentAt),
        isNull(schema.sessionEvents.canceledAt),
        // Computed "end time" filter: end = date + duration_hours hours.
        // Must be in the past (already ended) AND within the look-back
        // window (cron isn't spamming reminders for ancient stale rows
        // when the feature first ships).
        lte(
          sql`${schema.sessionEvents.date} + (${schema.sessionEvents.durationHours} * interval '1 hour')`,
          sql`${now.toISOString()}::timestamptz`
        ),
        sql`${schema.sessionEvents.date} + (${schema.sessionEvents.durationHours} * interval '1 hour') >= ${windowStart.toISOString()}::timestamptz`
      )
    );

  let notified = 0;
  let failed = 0;

  for (const row of candidates) {
    // The supervisor who needs to sign is whoever logged the row — the
    // active assignment fallback is consistent with daily-checks Pass 5's
    // prior behavior so we keep notifications targeted to the same person
    // even after Pass 5 is gone.
    let notifyUserId: string | null = row.loggedById;
    try {
      const assignment = await db.query.supervisorAssignments.findFirst({
        where: and(
          eq(schema.supervisorAssignments.superviseeId, row.superviseeId),
          eq(schema.supervisorAssignments.orgId, row.orgId),
          isNull(schema.supervisorAssignments.endedAt)
        ),
      });
      if (assignment) notifyUserId = assignment.supervisorId;
    } catch (err) {
      console.error("[cron sign-reminders] assignment lookup failed:", err);
    }

    // Stamp first so even if the notification write fails we won't
    // double-fire on the next tick. Reschedule resets this column.
    try {
      await db
        .update(schema.sessionEvents)
        .set({ signReminderSentAt: now })
        .where(eq(schema.sessionEvents.id, row.id));
    } catch (err) {
      console.error("[cron sign-reminders] stamp failed:", row.id, err);
      failed += 1;
      continue;
    }

    if (!notifyUserId) {
      // Nothing to notify — row already stamped so it won't re-fire.
      continue;
    }

    const scheduledForLocal = formatForUser(row.date, row.timeZone);
    try {
      await createNotification({
        userId: notifyUserId,
        kind: "session_sign_reminder",
        payload: {
          sessionId: row.id,
          superviseeId: row.superviseeId,
          superviseeName: row.superviseeName ?? row.superviseeEmail,
          sessionDate: row.date.toISOString(),
          sessionType: row.sessionType,
          durationHours: row.durationHours,
          scheduledForLocal,
        },
      });
      notified += 1;
    } catch (err) {
      console.error("[cron sign-reminders] notify failed:", row.id, err);
      failed += 1;
    }

    try {
      await logAuditEvent({
        orgId: row.orgId,
        actorUserId: null,
        action: AUDIT_ACTIONS.SESSION_SIGN_REMINDER_SENT,
        resourceType: "session_event",
        resourceId: row.id,
        details: {
          notifiedUserId: notifyUserId,
          scheduledFor: row.date.toISOString(),
        },
      });
    } catch (err) {
      console.error("[cron sign-reminders] audit failed:", row.id, err);
    }
  }

  return NextResponse.json({
    ok: true,
    runAt: now.toISOString(),
    scanned: candidates.length,
    notified,
    failed,
  });
}

function formatForUser(d: Date, timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      ...(timeZone ? { timeZone } : {}),
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
