export type ViewMode = "week" | "month" | "list";

export type StatusFilter =
  | "scheduled"
  | "completed"
  | "signed"
  | "canceled"
  | "no_show";

export type CalendarEvent = {
  id: string;
  superviseeId: string;
  superviseeName: string;
  /** UTC ISO start. The view renders in the viewer's local tz via Intl. */
  startIso: string;
  /** UTC ISO end (start + duration). */
  endIso: string;
  durationMinutes: number;
  sessionType: string | null;
  /** 'scheduled' | 'completed' | 'canceled' | 'no_show' | null
   *  (null = legacy logged-after-the-fact event). */
  scheduledStatus: string | null;
  /** Fully signed + sealed. Independent of scheduledStatus. */
  signed: boolean;
  /** 'teams' | 'google_meet' | 'in_person' | null. */
  meetingProvider: string | null;
  /** Deep link for the Join button (Teams/Meet). */
  meetingJoinUrl: string | null;
  /** IANA tz the event was scheduled IN — used to render the time
   *  consistently with how the supervisor set it. Falls back to the
   *  viewer's tz when null. */
  timeZone: string | null;
  /** HR Admin view only. Null for supervisor's own calendar. */
  supervisorName: string | null;
  supervisorId: string | null;
  /** Non-null when this row belongs to a recurring series. Drives
   *  reschedule-button visibility (v1 disallows single-instance moves)
   *  and the cancel-confirm copy that warns about the provider series. */
  recurringSeriesId: string | null;
};

export type Supervisee = {
  id: string;
  name: string;
};

/**
 * Compute the rendering status for an event from its raw fields. The
 * order matters — canceled wins over scheduled, signed wins over
 * completed, etc.
 */
export type EventVisualStatus =
  | "scheduled"
  | "happening_now"
  | "starts_soon"
  | "completed_pending_sign"
  | "signed"
  | "canceled"
  | "no_show";

export function visualStatusFor(
  e: CalendarEvent,
  now: number
): EventVisualStatus {
  if (e.scheduledStatus === "canceled") return "canceled";
  if (e.scheduledStatus === "no_show") return "no_show";
  if (e.signed) return "signed";
  const startMs = new Date(e.startIso).getTime();
  const endMs = new Date(e.endIso).getTime();
  if (e.scheduledStatus === "scheduled") {
    if (now >= startMs && now < endMs) return "happening_now";
    if (now >= startMs - 60 * 60_000 && now < startMs) return "starts_soon";
    return "scheduled";
  }
  // scheduledStatus is null (legacy) or 'completed': it happened, may
  // be awaiting sign.
  return "completed_pending_sign";
}
