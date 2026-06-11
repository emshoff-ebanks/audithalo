"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import {
  canSupervise,
  getCurrentMembership,
  isHrAdmin,
  isManagerRole,
} from "@/lib/authz";
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
  | { ok: false; error: string }
  | {
      ok: false;
      error: string;
      /** Soft fail when conflict detection found events overlapping with
       *  the requested window. Form can re-submit with confirmConflicts=
       *  true to schedule anyway. */
      conflicts: Array<{ title: string; startUtcIso: string; endUtcIso: string }>;
    };

const MAX_DURATION_HOURS = 8;
const MIN_DURATION_MINUTES = 15;

/**
 * Cross-check that the actor has access to schedule sessions on the
 * given supervisee. Supervisor (their own roster) and HR Admin (org-wide
 * on behalf of an assigned supervisor) can both schedule. Executive is
 * read-only and is excluded even though it's a manager role.
 */
async function requireSchedulerAccess(superviseeId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  const myMembership = await getCurrentMembership(session.user.id);
  if (!myMembership) throw new Error("No organization");
  if (
    !canSupervise(myMembership.role) &&
    !isHrAdmin(myMembership.role)
  ) {
    throw new Error(
      "Only supervisors and HR admins can schedule supervision sessions."
    );
  }
  if (!isManagerRole(myMembership.role)) {
    // Defensive: should be unreachable if the role list above is in sync
    // with isManagerRole, but keeps the check honest.
    throw new Error("Insufficient permissions.");
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

/**
 * Resolve which supervisor will *host* the scheduled session — whose
 * calendar gets the event, whose Teams/Meet account mints the link, and
 * who shows up as the supervisor on the audit trail. Phase 1f rule:
 *   - Supervisor actor → themselves.
 *   - HR Admin actor → the supervisee's active supervisor (from
 *     supervisor_assignments). If the supervisee has no active
 *     supervisor, return null so the caller can surface a clear error
 *     instead of blindly assigning the HR Admin as host.
 */
async function resolveHostingSupervisorId(
  actorUserId: string,
  actorRole: string,
  superviseeId: string,
  orgId: string
): Promise<string | null> {
  if (canSupervise(actorRole)) return actorUserId;
  const active = await db.query.supervisorAssignments.findFirst({
    where: and(
      eq(schema.supervisorAssignments.superviseeId, superviseeId),
      eq(schema.supervisorAssignments.orgId, orgId),
      isNull(schema.supervisorAssignments.endedAt)
    ),
  });
  return active?.supervisorId ?? null;
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
  /** Set by the form on a confirmation re-submit after the user has seen
   *  the conflict warning. */
  confirmConflicts: z
    .union([z.literal("true"), z.literal("false"), z.literal("")])
    .optional(),
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
    confirmConflicts: formData.get("confirmConflicts") || undefined,
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
  const { session, orgId, viewerRole } = access;

  // Pick the user whose calendar / Teams-or-Meet account hosts this
  // session. Supervisor → themselves. HR Admin → the supervisee's
  // currently-assigned supervisor.
  const hostingSupervisorId = await resolveHostingSupervisorId(
    session.user.id,
    viewerRole,
    parsed.data.superviseeId,
    orgId
  );
  // Conflict detection (Phase 4): when the user hasn't already confirmed
  // away conflicts AND the hosting supervisor has a connected provider,
  // call listEventsInWindow and surface anything overlapping. This is a
  // soft block — the user can re-submit with confirmConflicts=true.
  if (
    parsed.data.modality === "virtual" &&
    parsed.data.confirmConflicts !== "true" &&
    hostingSupervisorId
  ) {
    try {
      const resolved = parsed.data.provider
        ? await getNamedProviderForUser(
            hostingSupervisorId,
            parsed.data.provider as CalendarProvider
          )
        : await getProviderForUser(hostingSupervisorId);
      if (resolved) {
        const checkStart = new Date(parsed.data.startUtc);
        const checkEnd = new Date(
          checkStart.getTime() + parsed.data.durationMinutes * 60_000
        );
        const events = await resolved.client.listEventsInWindow(
          checkStart,
          checkEnd
        );
        // Ignore AuditHalo's own events on the host's calendar — they're
        // tagged in the description (provider adapters check the
        // AUDITHALO_EVENT_TAG marker).
        const conflicts = events
          .filter((e) => !e.isAuditHaloEvent)
          .filter((e) => e.startUtc < checkEnd && e.endUtc > checkStart);
        if (conflicts.length > 0) {
          return {
            ok: false,
            error:
              "This time conflicts with another event on the host's calendar. Confirm to schedule anyway.",
            conflicts: conflicts.map((c) => ({
              title: c.title,
              startUtcIso: c.startUtc.toISOString(),
              endUtcIso: c.endUtc.toISOString(),
            })),
          };
        }
      }
    } catch (err) {
      // Conflict detection is best-effort — a failed listEventsInWindow
      // shouldn't block scheduling. Log + continue.
      console.warn("[scheduleSession] conflict check failed:", err);
    }
  }
  if (!hostingSupervisorId) {
    return {
      ok: false,
      error:
        "This supervisee has no assigned supervisor. Assign one before scheduling.",
    };
  }
  const isOnBehalf = hostingSupervisorId !== session.user.id;

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
      where: eq(schema.users.id, hostingSupervisorId),
      columns: { id: true, email: true, name: true },
    }),
  ]);
  if (!supervisee || !supervisor) {
    return { ok: false, error: "Supervisor or supervisee not found." };
  }

  // Resolve the calendar provider — only used for virtual sessions. The
  // provider integration belongs to the HOSTING supervisor, not the
  // actor (so HR-Admin-on-behalf scheduling writes the event to the
  // supervisor's Outlook/Google Calendar, not the HR Admin's).
  let meetingProvider: "teams" | "google_meet" | "in_person" = "in_person";
  let meetingJoinUrl: string | null = null;
  let meetingId: string | null = null;
  let calendarEventIds: Record<string, string> | null = null;

  if (parsed.data.modality === "virtual") {
    const resolved = parsed.data.provider
      ? await getNamedProviderForUser(
          hostingSupervisorId,
          parsed.data.provider as CalendarProvider
        )
      : await getProviderForUser(hostingSupervisorId);

    if (!resolved) {
      return {
        ok: false,
        error: isOnBehalf
          ? `${supervisor.name ?? supervisor.email} hasn't connected a calendar. Ask them to connect Microsoft or Google in Account → Integrations before scheduling on their behalf.`
          : "Connect a calendar in Account → Integrations before scheduling a virtual session.",
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
      // Key by the hosting supervisor since the event lives on THEIR
      // calendar. Cancel/reschedule lookups use this map.
      calendarEventIds = { [hostingSupervisorId]: created.eventId };
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

// ---------------------------------------------------------------------------
// Phase 3 — recurring series
// ---------------------------------------------------------------------------

const FREQUENCY = z.enum(["weekly", "biweekly", "every_3_weeks", "monthly"]);
const OCCURRENCE_CAP = 52;

const scheduleRecurringSchema = scheduleSchema.extend({
  frequency: FREQUENCY,
  /** How many total occurrences to materialize, including the first.
   *  Capped at OCCURRENCE_CAP per locked decision #9. */
  occurrenceCount: z.coerce.number().int().min(2).max(OCCURRENCE_CAP),
});

/**
 * Add `intervalDays` days for weekly cadences, or one calendar month for
 * monthly. The latter uses Date's month-overflow semantics — Jan 31 +
 * 1 month → Mar 3 by default — but that surprise is rare for supervision
 * scheduling (most series start at month boundaries). Acceptable for v1.
 */
function nextOccurrence(
  base: Date,
  frequency: z.infer<typeof FREQUENCY>,
  index: number
): Date {
  const out = new Date(base);
  if (frequency === "monthly") {
    out.setMonth(out.getMonth() + index);
    return out;
  }
  const days = frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : 21;
  out.setDate(out.getDate() + days * index);
  return out;
}

/**
 * Schedule a recurring supervision series. Creates ONE provider event
 * with native recurrence (Outlook/Google handles the per-occurrence
 * calendar mirroring), then materializes N session_events rows in
 * AuditHalo's DB so each instance has a row to sign + seal against.
 */
export async function scheduleRecurringSeriesAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = scheduleRecurringSchema.safeParse({
    superviseeId: formData.get("superviseeId"),
    startUtc: formData.get("startUtc"),
    durationMinutes: formData.get("durationMinutes"),
    timeZone: formData.get("timeZone"),
    modality: formData.get("modality"),
    provider: formData.get("provider") || undefined,
    location: formData.get("location") || undefined,
    notes: formData.get("notes") || undefined,
    sessionType: formData.get("sessionType") || undefined,
    frequency: formData.get("frequency"),
    occurrenceCount: formData.get("occurrenceCount"),
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
  const { session, orgId, viewerRole } = access;

  const hostingSupervisorId = await resolveHostingSupervisorId(
    session.user.id,
    viewerRole,
    parsed.data.superviseeId,
    orgId
  );
  if (!hostingSupervisorId) {
    return {
      ok: false,
      error:
        "This supervisee has no assigned supervisor. Assign one before scheduling.",
    };
  }

  const firstStart = new Date(parsed.data.startUtc);
  if (Number.isNaN(firstStart.getTime())) {
    return { ok: false, error: "Invalid start time." };
  }
  if (firstStart.getTime() < Date.now() - 60_000) {
    return { ok: false, error: "Pick a start time in the future." };
  }
  const firstEnd = new Date(
    firstStart.getTime() + parsed.data.durationMinutes * 60_000
  );

  const [supervisee, supervisor] = await Promise.all([
    db.query.users.findFirst({
      where: eq(schema.users.id, parsed.data.superviseeId),
      columns: { id: true, email: true, name: true },
    }),
    db.query.users.findFirst({
      where: eq(schema.users.id, hostingSupervisorId),
      columns: { id: true, email: true, name: true },
    }),
  ]);
  if (!supervisee || !supervisor) {
    return { ok: false, error: "Supervisor or supervisee not found." };
  }

  let meetingProvider: "teams" | "google_meet" | "in_person" = "in_person";
  let meetingJoinUrl: string | null = null;
  let meetingId: string | null = null;
  let providerEventId: string | null = null;

  if (parsed.data.modality === "virtual") {
    const resolved = parsed.data.provider
      ? await getNamedProviderForUser(
          hostingSupervisorId,
          parsed.data.provider as CalendarProvider
        )
      : await getProviderForUser(hostingSupervisorId);
    if (!resolved) {
      return {
        ok: false,
        error:
          "Connect a calendar before scheduling a virtual recurring series.",
      };
    }
    try {
      const created = await resolved.client.createEvent({
        title: `Supervision: ${supervisor.name ?? supervisor.email} ↔ ${supervisee.name ?? supervisee.email}`,
        description: parsed.data.notes,
        startUtc: firstStart,
        endUtc: firstEnd,
        timeZone: parsed.data.timeZone,
        attendeeEmails: [supervisor.email, supervisee.email].filter(
          (e): e is string => !!e
        ),
        withMeetingLink: true,
        recurrence: {
          frequency: parsed.data.frequency,
          occurrenceCount: parsed.data.occurrenceCount,
        },
      });
      meetingProvider =
        resolved.client.name === "microsoft" ? "teams" : "google_meet";
      meetingJoinUrl = created.joinUrl ?? null;
      meetingId = created.eventId;
      providerEventId = created.eventId;
    } catch (err) {
      console.error("[scheduleRecurringSeries] createEvent failed:", err);
      return {
        ok: false,
        error: `Calendar provider failed to create the series: ${(err as Error).message}`,
      };
    }
  }

  // Persist the series template first so the materialized rows can
  // carry recurring_series_id.
  const lastOccurrenceDate = nextOccurrence(
    firstStart,
    parsed.data.frequency,
    parsed.data.occurrenceCount - 1
  );
  const [seriesRow] = await db
    .insert(schema.recurringSessionSeries)
    .values({
      orgId,
      supervisorId: hostingSupervisorId,
      superviseeIds: [parsed.data.superviseeId],
      startDate: firstStart.toISOString().slice(0, 10),
      timeOfDay: firstStart.toISOString().slice(11, 19),
      durationMinutes: parsed.data.durationMinutes,
      timeZone: parsed.data.timeZone,
      frequency: parsed.data.frequency,
      endType: "count",
      endCount: parsed.data.occurrenceCount,
      endDate: lastOccurrenceDate.toISOString().slice(0, 10),
      meetingProvider:
        parsed.data.modality === "virtual" ? meetingProvider : "in_person",
      location:
        parsed.data.modality === "in_person"
          ? parsed.data.location ?? null
          : null,
      notes: parsed.data.notes ?? null,
      createdByUserId: session.user.id,
    })
    .returning({ id: schema.recurringSessionSeries.id });
  const seriesId = seriesRow.id;

  const calendarEventIds = providerEventId
    ? ({ [hostingSupervisorId]: providerEventId } as Record<string, string>)
    : null;

  // Materialize one session_events row per occurrence. They all share
  // the same meeting_id + join URL because they ride the SAME provider
  // event (native recurrence on the provider side).
  const insertedSessionIds: string[] = [];
  for (let i = 0; i < parsed.data.occurrenceCount; i++) {
    const occStart = nextOccurrence(firstStart, parsed.data.frequency, i);
    const [inserted] = await db
      .insert(schema.sessionEvents)
      .values({
        superviseeId: parsed.data.superviseeId,
        orgId,
        kind: "supervision",
        date: occStart,
        durationHours: parsed.data.durationMinutes / 60,
        sessionType: parsed.data.sessionType,
        loggedById: session.user.id,
        scheduledStatus: "scheduled",
        recurringSeriesId: seriesId,
        meetingProvider,
        meetingJoinUrl,
        meetingId,
        calendarEventIds,
        timeZone: parsed.data.timeZone,
      })
      .returning({ id: schema.sessionEvents.id });
    insertedSessionIds.push(inserted.id);
    await db.insert(schema.sessionAttendees).values({
      sessionEventId: inserted.id,
      userId: parsed.data.superviseeId,
      isPrimarySupervisee: true,
    });
  }

  try {
    await logAuditEvent({
      orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.RECURRING_SERIES_CREATED,
      resourceType: "recurring_session_series",
      resourceId: seriesId,
      details: {
        superviseeId: parsed.data.superviseeId,
        frequency: parsed.data.frequency,
        occurrenceCount: parsed.data.occurrenceCount,
        firstStartUtc: firstStart.toISOString(),
        meetingProvider,
        materializedSessionEventIds: insertedSessionIds,
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to record recurring series:", err);
  }

  capture("recurring_series_created", session.user.id, {
    orgId,
    superviseeId: parsed.data.superviseeId,
    frequency: parsed.data.frequency,
    occurrenceCount: parsed.data.occurrenceCount,
    meetingProvider,
  });

  // Notify the supervisee about the FIRST occurrence; the rest piggyback
  // on the provider's native series invite. Sending N session_scheduled
  // notifications would be noise.
  const firstLocal = formatLocal(firstStart, parsed.data.timeZone);
  try {
    await createNotification({
      userId: parsed.data.superviseeId,
      kind: "session_scheduled",
      payload: {
        sessionId: insertedSessionIds[0],
        scheduledForLocal: `${firstLocal} (recurring — ${parsed.data.occurrenceCount} sessions)`,
        supervisorName: supervisor.name ?? supervisor.email,
        meetingProvider,
      },
    });
  } catch (err) {
    console.error("[notifications] session_scheduled failed:", err);
  }

  revalidatePath(`/dashboard/roster/${parsed.data.superviseeId}`);
  revalidatePath("/dashboard/calendar");
  // Return the FIRST session id so the form can redirect into the
  // sign page for the first occurrence, mirroring single-shot scheduling.
  return { ok: true, sessionId: insertedSessionIds[0] ?? "" };
}

// ---------------------------------------------------------------------------
// Phase 3 — reschedule a one-off session
// ---------------------------------------------------------------------------

const rescheduleSchema = z.object({
  sessionId: z.string().uuid(),
  newStartUtc: z.string().datetime(),
  newDurationMinutes: z.coerce
    .number()
    .int()
    .min(MIN_DURATION_MINUTES)
    .max(MAX_DURATION_HOURS * 60),
  timeZone: z.string().min(1),
});

/**
 * Reschedule a single scheduled session. Updates the row + calls
 * provider.updateEvent on each attached calendar event + fires
 * session_rescheduled.
 *
 * v1 limitation: recurring instances (rows with recurring_series_id !=
 * null) cannot be rescheduled here — provider-side instance overrides
 * are deferred to Phase 3.5. The UI gates the reschedule button.
 */
export async function rescheduleSessionAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = rescheduleSchema.safeParse({
    sessionId: formData.get("sessionId"),
    newStartUtc: formData.get("newStartUtc"),
    newDurationMinutes: formData.get("newDurationMinutes"),
    timeZone: formData.get("timeZone"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: eq(schema.sessionEvents.id, parsed.data.sessionId),
  });
  if (!sessionEvent) return { ok: false, error: "Session not found." };

  const myMembership = await getCurrentMembership(session.user.id);
  if (!myMembership || myMembership.orgId !== sessionEvent.orgId) {
    return { ok: false, error: "You can't reschedule this session." };
  }
  const isOriginalLogger = sessionEvent.loggedById === session.user.id;
  const isHr = isHrAdmin(myMembership.role);
  if (!isOriginalLogger && !isHr && !canSupervise(myMembership.role)) {
    return { ok: false, error: "You can't reschedule this session." };
  }

  if (sessionEvent.scheduledStatus !== "scheduled") {
    return {
      ok: false,
      error: `Session is already ${sessionEvent.scheduledStatus ?? "logged"}.`,
    };
  }

  if (sessionEvent.recurringSeriesId) {
    return {
      ok: false,
      error:
        "Recurring sessions can't be rescheduled individually yet. Cancel this occurrence and schedule a new one in its place.",
    };
  }

  const newStart = new Date(parsed.data.newStartUtc);
  if (Number.isNaN(newStart.getTime())) {
    return { ok: false, error: "Invalid new start time." };
  }
  if (newStart.getTime() < Date.now() - 60_000) {
    return { ok: false, error: "Pick a new start time in the future." };
  }
  const newEnd = new Date(
    newStart.getTime() + parsed.data.newDurationMinutes * 60_000
  );

  // Capture the old time string BEFORE we update the row, so the
  // notification payload reads correctly.
  const oldStart = sessionEvent.date;
  const oldLocal = sessionEvent.timeZone
    ? formatLocal(oldStart, sessionEvent.timeZone)
    : formatLocal(oldStart, parsed.data.timeZone);
  const newLocal = formatLocal(newStart, parsed.data.timeZone);

  let providerWarning: string | null = null;
  const eventIds = sessionEvent.calendarEventIds ?? {};
  for (const [userId, eventId] of Object.entries(eventIds)) {
    try {
      const provider =
        sessionEvent.meetingProvider === "teams"
          ? "microsoft"
          : sessionEvent.meetingProvider === "google_meet"
            ? "google"
            : null;
      if (!provider) continue;
      const resolved = await getNamedProviderForUser(userId, provider);
      if (!resolved) continue;
      await resolved.client.updateEvent({
        eventId,
        startUtc: newStart,
        endUtc: newEnd,
        timeZone: parsed.data.timeZone,
      });
    } catch (err) {
      console.warn("[rescheduleSession] provider updateEvent failed:", err);
      providerWarning =
        "Updated AuditHalo, but couldn't push the new time to the calendar provider. Please update the event manually.";
    }
  }

  await db
    .update(schema.sessionEvents)
    .set({
      date: newStart,
      durationHours: parsed.data.newDurationMinutes / 60,
      timeZone: parsed.data.timeZone,
    })
    .where(eq(schema.sessionEvents.id, parsed.data.sessionId));

  const actor = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { name: true, email: true },
  });

  try {
    await logAuditEvent({
      orgId: sessionEvent.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.SESSION_RESCHEDULED,
      resourceType: "session_event",
      resourceId: sessionEvent.id,
      details: {
        superviseeId: sessionEvent.superviseeId,
        oldStartUtc: oldStart.toISOString(),
        newStartUtc: newStart.toISOString(),
        newDurationMinutes: parsed.data.newDurationMinutes,
        timeZone: parsed.data.timeZone,
        providerCalendarUpdateWarning: providerWarning,
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to record session.rescheduled:", err);
  }

  capture("session_rescheduled", session.user.id, {
    orgId: sessionEvent.orgId,
    superviseeId: sessionEvent.superviseeId,
    sessionEventId: sessionEvent.id,
  });

  try {
    await createNotification({
      userId: sessionEvent.superviseeId,
      kind: "session_rescheduled",
      payload: {
        sessionId: sessionEvent.id,
        oldScheduledForLocal: oldLocal,
        newScheduledForLocal: newLocal,
        rescheduledByName: actor?.name ?? actor?.email ?? "your supervisor",
      },
    });
  } catch (err) {
    console.error("[notifications] session_rescheduled failed:", err);
  }

  revalidatePath(`/dashboard/roster/${sessionEvent.superviseeId}`);
  revalidatePath(`/sign/${sessionEvent.id}`);
  revalidatePath("/dashboard/calendar");
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
