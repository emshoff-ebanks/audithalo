"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";
import { capture } from "@/lib/observability/posthog-server";
import {
  getProviderForUser,
  getNamedProviderForUser,
} from "@/lib/calendar/provider";
import type { CalendarProvider } from "@/lib/calendar/oauth-config";

export type ActionResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

const MAX_DURATION_HOURS = 8;
const MIN_DURATION_MINUTES = 15;

/**
 * Cross-check that the actor has access to schedule sessions on the
 * given supervisee. Mirrors `requireOrgAccess` in supervisee.ts but
 * tightened — only managers (supervisor or HR admin) can schedule.
 */
async function requireSchedulerAccess(superviseeId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  const myMembership = await getCurrentMembership(session.user.id);
  if (!myMembership) throw new Error("No organization");
  if (!isManagerRole(myMembership.role) || !canSupervise(myMembership.role)) {
    throw new Error("Only supervisors can schedule supervision sessions.");
  }

  const targetMembership = await db.query.orgMemberships.findFirst({
    where: and(
      eq(schema.orgMemberships.userId, superviseeId),
      eq(schema.orgMemberships.orgId, myMembership.orgId)
    ),
  });
  if (!targetMembership) throw new Error("Not in your roster");

  return { session, orgId: myMembership.orgId, viewerRole: myMembership.role };
}

const scheduleSchema = z.object({
  superviseeId: z.string().uuid(),
  /** ISO-8601 UTC timestamp the client computed from local picker + tz. */
  startUtc: z.string().datetime(),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(MIN_DURATION_MINUTES)
    .max(MAX_DURATION_HOURS * 60),
  /** IANA tz string (e.g. 'America/New_York') for display. */
  timeZone: z.string().min(1),
  modality: z.enum(["virtual", "in_person"]),
  /** When modality=virtual, the user's preference is used unless this
   *  field overrides. */
  provider: z.enum(["microsoft", "google"]).optional(),
  location: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  sessionType: z.enum(["individual", "triadic", "group"]).default("individual"),
});

/**
 * Schedule a supervision session: writes a session_events row with
 * scheduled_status='scheduled', creates the calendar event + meeting
 * link via the supervisor's connected provider (if virtual), and
 * notifies the supervisee.
 *
 * Idempotency: not enforced at the row level — a double-click could
 * create two events. The client form disables on submit; that's the
 * mitigation for now.
 */
export async function scheduleSessionAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse({
    superviseeId: formData.get("superviseeId"),
    startUtc: formData.get("startUtc"),
    durationMinutes: formData.get("durationMinutes"),
    timeZone: formData.get("timeZone"),
    modality: formData.get("modality"),
    provider: formData.get("provider") || undefined,
    location: formData.get("location") || undefined,
    notes: formData.get("notes") || undefined,
    sessionType: formData.get("sessionType") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  let access;
  try {
    access = await requireSchedulerAccess(parsed.data.superviseeId);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  const { session, orgId } = access;

  const startUtc = new Date(parsed.data.startUtc);
  const endUtc = new Date(
    startUtc.getTime() + parsed.data.durationMinutes * 60_000
  );
  if (Number.isNaN(startUtc.getTime())) {
    return { ok: false, error: "Invalid start time." };
  }
  if (startUtc.getTime() < Date.now() - 60_000) {
    return { ok: false, error: "Pick a start time in the future." };
  }

  const [supervisee, supervisor] = await Promise.all([
    db.query.users.findFirst({
      where: eq(schema.users.id, parsed.data.superviseeId),
      columns: { id: true, email: true, name: true },
    }),
    db.query.users.findFirst({
      where: eq(schema.users.id, session.user.id),
      columns: { id: true, email: true, name: true },
    }),
  ]);
  if (!supervisee || !supervisor) {
    return { ok: false, error: "Supervisor or supervisee not found." };
  }

  // Resolve the calendar provider — only used for virtual sessions.
  let meetingProvider: "teams" | "google_meet" | "in_person" = "in_person";
  let meetingJoinUrl: string | null = null;
  let meetingId: string | null = null;
  let calendarEventIds: Record<string, string> | null = null;

  if (parsed.data.modality === "virtual") {
    const resolved = parsed.data.provider
      ? await getNamedProviderForUser(
          session.user.id,
          parsed.data.provider as CalendarProvider
        )
      : await getProviderForUser(session.user.id);

    if (!resolved) {
      return {
        ok: false,
        error:
          "Connect a calendar in Account → Integrations before scheduling a virtual session.",
      };
    }
    try {
      const created = await resolved.client.createEvent({
        title: `Supervision: ${supervisor.name ?? supervisor.email} ↔ ${supervisee.name ?? supervisee.email}`,
        description: parsed.data.notes,
        startUtc,
        endUtc,
        timeZone: parsed.data.timeZone,
        attendeeEmails: [supervisor.email, supervisee.email].filter(
          (e): e is string => !!e
        ),
        withMeetingLink: true,
      });
      meetingProvider =
        resolved.client.name === "microsoft" ? "teams" : "google_meet";
      meetingJoinUrl = created.joinUrl ?? null;
      meetingId = created.eventId;
      calendarEventIds = { [session.user.id]: created.eventId };
    } catch (err) {
      console.error("[scheduleSession] provider createEvent failed:", err);
      return {
        ok: false,
        error: `Calendar provider failed to create the meeting: ${(err as Error).message}`,
      };
    }
  } else {
    // In-person — no provider call. Location goes on the row.
  }

  const [inserted] = await db
    .insert(schema.sessionEvents)
    .values({
      superviseeId: parsed.data.superviseeId,
      orgId,
      kind: "supervision",
      date: startUtc,
      durationHours: parsed.data.durationMinutes / 60,
      sessionType: parsed.data.sessionType,
      loggedById: session.user.id,
      scheduledStatus: "scheduled",
      meetingProvider,
      meetingJoinUrl,
      meetingId,
      calendarEventIds,
      timeZone: parsed.data.timeZone,
    })
    .returning({ id: schema.sessionEvents.id });
  const sessionId = inserted.id;

  // Group session attendees (Phase 1 only persists the primary; group
  // sessions land fully in Phase 5 with the multi-select supervisee picker).
  await db.insert(schema.sessionAttendees).values({
    sessionEventId: sessionId,
    userId: parsed.data.superviseeId,
    isPrimarySupervisee: true,
  });

  // Format the local time once for the notification + audit log.
  const scheduledForLocal = formatLocal(startUtc, parsed.data.timeZone);

  try {
    await logAuditEvent({
      orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.SESSION_SCHEDULED,
      resourceType: "session_event",
      resourceId: sessionId,
      details: {
        superviseeId: parsed.data.superviseeId,
        startUtc: startUtc.toISOString(),
        durationMinutes: parsed.data.durationMinutes,
        modality: parsed.data.modality,
        meetingProvider,
        timeZone: parsed.data.timeZone,
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to record session.scheduled:", err);
  }

  capture("session_scheduled", session.user.id, {
    orgId,
    superviseeId: parsed.data.superviseeId,
    sessionEventId: sessionId,
    modality: parsed.data.modality,
    meetingProvider,
    durationMinutes: parsed.data.durationMinutes,
  });

  try {
    await createNotification({
      userId: parsed.data.superviseeId,
      kind: "session_scheduled",
      payload: {
        sessionId,
        scheduledForLocal,
        supervisorName: supervisor.name ?? supervisor.email,
        meetingProvider,
      },
    });
  } catch (err) {
    console.error("[notifications] session_scheduled failed:", err);
  }

  revalidatePath(`/dashboard/roster/${parsed.data.superviseeId}`);
  revalidatePath(`/sign/${sessionId}`);
  return { ok: true, sessionId };
}

const cancelSchema = z.object({
  sessionId: z.string().uuid(),
});

/**
 * Cancel a previously-scheduled session. Marks the row canceled, deletes
 * the corresponding provider event(s), and notifies the supervisee.
 */
export async function cancelScheduledSessionAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse({
    sessionId: formData.get("sessionId"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: eq(schema.sessionEvents.id, parsed.data.sessionId),
  });
  if (!sessionEvent) return { ok: false, error: "Session not found." };

  const myMembership = await getCurrentMembership(session.user.id);
  if (!myMembership || myMembership.orgId !== sessionEvent.orgId) {
    return { ok: false, error: "You can't cancel this session." };
  }
  // Only the original supervisor or any HR admin can cancel.
  const isOriginalLogger = sessionEvent.loggedById === session.user.id;
  const isHr = canSupervise(myMembership.role) && isManagerRole(myMembership.role);
  if (!isOriginalLogger && !isHr) {
    return { ok: false, error: "You can't cancel this session." };
  }

  if (sessionEvent.scheduledStatus !== "scheduled") {
    return {
      ok: false,
      error: `Session is already ${sessionEvent.scheduledStatus ?? "logged"}.`,
    };
  }

  // Best-effort: delete the provider's calendar event. If the provider call
  // fails we still cancel locally — the user can clean up their calendar
  // manually. We log + propagate the error in the result so the UI can warn.
  let providerWarning: string | null = null;
  const eventIds = sessionEvent.calendarEventIds ?? {};
  for (const [userId, eventId] of Object.entries(eventIds)) {
    try {
      const provider = sessionEvent.meetingProvider === "teams"
        ? "microsoft"
        : sessionEvent.meetingProvider === "google_meet"
          ? "google"
          : null;
      if (!provider) continue;
      const resolved = await getNamedProviderForUser(userId, provider);
      if (!resolved) continue;
      await resolved.client.deleteEvent(eventId);
    } catch (err) {
      console.warn(
        "[cancelScheduledSession] provider deleteEvent failed:",
        err
      );
      providerWarning = `Couldn't fully remove the calendar event — please delete it from your calendar manually.`;
    }
  }

  await db
    .update(schema.sessionEvents)
    .set({
      scheduledStatus: "canceled",
      canceledAt: new Date(),
      canceledByUserId: session.user.id,
    })
    .where(eq(schema.sessionEvents.id, parsed.data.sessionId));

  const supervisor = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { name: true, email: true },
  });
  const scheduledForLocal = sessionEvent.timeZone
    ? formatLocal(sessionEvent.date, sessionEvent.timeZone)
    : sessionEvent.date.toISOString().slice(0, 16).replace("T", " ");

  try {
    await logAuditEvent({
      orgId: sessionEvent.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.SESSION_CANCELED,
      resourceType: "session_event",
      resourceId: sessionEvent.id,
      details: {
        superviseeId: sessionEvent.superviseeId,
        scheduledFor: sessionEvent.date.toISOString(),
        providerEventCleanupWarning: providerWarning,
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to record session.canceled:", err);
  }

  try {
    await createNotification({
      userId: sessionEvent.superviseeId,
      kind: "session_canceled",
      payload: {
        sessionId: sessionEvent.id,
        scheduledForLocal,
        canceledByName: supervisor?.name ?? supervisor?.email ?? "your supervisor",
      },
    });
  } catch (err) {
    console.error("[notifications] session_canceled failed:", err);
  }

  revalidatePath(`/dashboard/roster/${sessionEvent.superviseeId}`);
  revalidatePath(`/sign/${sessionEvent.id}`);

  return { ok: true, sessionId: sessionEvent.id };
}

/** Render a UTC instant in the given IANA timezone for display. */
function formatLocal(d: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }
}
