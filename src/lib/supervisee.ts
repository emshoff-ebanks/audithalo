import type { schema } from "@/lib/db";

type SessionEvent = typeof schema.sessionEvents.$inferSelect;

/**
 * Pure helper for the supervisee dashboard.
 *
 * Returns the supervision sessions that are awaiting THIS user's signature —
 * i.e. supervision events that:
 *   - are supervision (not practice — those don't co-sign)
 *   - are not yet fully sealed (`signedAt` is null)
 *   - this user has not already signed
 *   - have actually happened (`scheduledStatus !== "scheduled"` and the
 *     start date is in the past)
 *
 * Future scheduled sessions are excluded — they haven't happened yet, so
 * there's nothing to sign. Listing them under "Needs your signature" is
 * actively misleading.
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
    if (e.scheduledStatus === "scheduled") return false;
    if (e.scheduledStatus === "canceled") return false;
    if (e.scheduledStatus === "no_show") return false;
    // Belt-and-braces: a row with no scheduledStatus but a future date is
    // still not actionable.
    const startMs =
      e.date instanceof Date ? e.date.getTime() : Date.parse(String(e.date));
    if (Number.isFinite(startMs) && startMs > nowMs) return false;
    return true;
  });
}
