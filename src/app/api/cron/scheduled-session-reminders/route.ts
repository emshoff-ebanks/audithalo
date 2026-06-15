import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { db, schema } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { verifyCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sentry Cron monitor slug for /api/cron/scheduled-session-reminders.
 * Vercel cron minimum is 5 minutes, so we fire every 5 minutes and target
 * sessions whose start lands inside the matching window. The notification
 * dedupe key is (userId, sessionId, kind) so a session never gets the
 * same reminder twice even if two cron passes both catch it.
 */
const CRON_MONITOR_SLUG = "scheduled-session-reminders";
const CRON_MONITOR_CONFIG = {
  schedule: { type: "crontab" as const, value: "*/5 * * * *" },
  checkinMargin: 5,
  maxRuntime: 5,
  timezone: "UTC",
};

/**
 * Map cron kind → window (minutes ahead from "now") in which a session
 * start qualifies. Each is a 6-minute slice to allow for the 5-minute
 * cron tick + small drift; dedupe handles the rare overlap.
 *
 * 1-hour reminder: 57–63 min ahead
 * 15-min reminder: 12–18 min ahead
 */
const REMINDER_WINDOWS: Array<{
  kind: "session_reminder_1hour" | "session_reminder_15min";
  minAheadMs: number;
  maxAheadMs: number;
}> = [
  {
    kind: "session_reminder_1hour",
    minAheadMs: 57 * 60_000,
    maxAheadMs: 63 * 60_000,
  },
  {
    kind: "session_reminder_15min",
    minAheadMs: 12 * 60_000,
    maxAheadMs: 18 * 60_000,
  },
];

async function fireReminders(now: number): Promise<{
  scanned: number;
  sent: number;
  skippedAlreadySent: number;
}> {
  let scanned = 0;
  let sent = 0;
  let skippedAlreadySent = 0;

  for (const window of REMINDER_WINDOWS) {
    const start = new Date(now + window.minAheadMs);
    const end = new Date(now + window.maxAheadMs);
    const sessions = await db
      .select({
        id: schema.sessionEvents.id,
        superviseeId: schema.sessionEvents.superviseeId,
        date: schema.sessionEvents.date,
        timeZone: schema.sessionEvents.timeZone,
        meetingProvider: schema.sessionEvents.meetingProvider,
        meetingJoinUrl: schema.sessionEvents.meetingJoinUrl,
        loggedById: schema.sessionEvents.loggedById,
      })
      .from(schema.sessionEvents)
      .where(
        and(
          eq(schema.sessionEvents.scheduledStatus, "scheduled"),
          gte(schema.sessionEvents.date, start),
          lte(schema.sessionEvents.date, end)
        )
      );

    for (const s of sessions) {
      scanned++;
      // Attendees = primary supervisee + the supervisor who logged it.
      // session_attendees rows are added by scheduleSessionAction; we
      // walk that for group sessions in Phase 5.
      const attendees = await db
        .select({ userId: schema.sessionAttendees.userId })
        .from(schema.sessionAttendees)
        .where(eq(schema.sessionAttendees.sessionEventId, s.id));
      const attendeeIds = new Set<string>();
      attendees.forEach((a) => attendeeIds.add(a.userId));
      attendeeIds.add(s.loggedById);

      const scheduledForLocal = s.timeZone
        ? new Intl.DateTimeFormat("en-US", {
            timeZone: s.timeZone,
            dateStyle: "medium",
            timeStyle: "short",
          }).format(s.date)
        : s.date.toISOString().slice(0, 16).replace("T", " ") + " UTC";

      for (const userId of attendeeIds) {
        // Dedupe: skip if this user already has this kind for this session.
        const existing = await db.query.notifications.findFirst({
          where: and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.kind, window.kind)
          ),
        });
        // The findFirst above is broad — narrow by payload sessionId at
        // the JS level since the payload column is jsonb without a
        // composite-key index. Cheap because the row count is tiny.
        const already = await db.query.notifications.findMany({
          where: and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.kind, window.kind)
          ),
        });
        const dup = already.some(
          (n) =>
            n.payload &&
            typeof n.payload === "object" &&
            (n.payload as Record<string, unknown>).sessionId === s.id
        );
        if (existing && dup) {
          skippedAlreadySent++;
          continue;
        }
        try {
          await createNotification({
            userId,
            kind: window.kind,
            payload: {
              sessionId: s.id,
              scheduledForLocal,
              meetingProvider: s.meetingProvider,
              joinUrl: s.meetingJoinUrl,
            },
          });
          sent++;
        } catch (err) {
          console.error(
            `[reminders] createNotification failed for ${userId}/${s.id}/${window.kind}:`,
            err
          );
        }
      }
    }
  }

  return { scanned, sent, skippedAlreadySent };
}

async function handle(request: Request) {
  const authFail = verifyCronAuth(request);
  if (authFail) return authFail;
  const now = Date.now();
  const result = await fireReminders(now);
  return NextResponse.json({ ok: true, ...result });
}

export const GET = (request: Request) =>
  Sentry.withMonitor(
    CRON_MONITOR_SLUG,
    () => handle(request),
    CRON_MONITOR_CONFIG
  );

export const POST = GET;
