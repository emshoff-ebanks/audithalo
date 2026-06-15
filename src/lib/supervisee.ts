import type { schema } from "@/lib/db";

type SessionEvent = typeof schema.sessionEvents.$inferSelect;

/**
 * Pure helper for the supervisee dashboard.
 *
 * Returns the supervision sessions that are awaiting THIS user's signature.
 * The filter:
 *   - kind === "supervision" (practice events don't co-sign)
 *   - signedAt is null (not yet fully sealed)
 *   - this user hasn't already added their signature
 *   - the meeting's END time has passed — i.e. it actually happened
 *   - not explicitly canceled or marked no_show
 *
 * Crucially we key on END TIME, not scheduledStatus, because after the
 * 2026-06-15 sign-reminder change we no longer auto-flip past-end rows
 * to a new status. A row whose meeting ended hours ago can still carry
 * scheduledStatus='scheduled' indefinitely until the supervisor signs
 * or marks "this didn't happen." Filtering out everything tagged
 * 'scheduled' wrongly hides those past-end rows from the user who
 * needs to sign them.
 */
export function pendingSignaturesForUser(
  events: SessionEvent[],
  userId: string,
  now: Date = new Date()
): SessionEvent[] {
  const nowMs = now.getTime();
  return events.filter((e) => {
    if (e.kind !== "supervision") return false;
    if (e.signedAt) return false;
    if ((e.signatures ?? []).some((s) => s.signerId === userId)) return false;
    if (e.scheduledStatus === "canceled") return false;
    if (e.scheduledStatus === "no_show") return false;
    const startMs =
      e.date instanceof Date ? e.date.getTime() : Date.parse(String(e.date));
    if (!Number.isFinite(startMs)) return false;
    const durationHours = e.durationHours ?? 0;
    const endMs = startMs + durationHours * 60 * 60_000;
    // Meeting hasn't ended yet → not actionable. After end, it's
    // signable whether the row still says 'scheduled' or has gone to
    // 'completed' or has a null status (legacy after-the-fact log).
    if (endMs > nowMs) return false;
    return true;
  });
}
