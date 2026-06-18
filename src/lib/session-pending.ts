/**
 * Row-level "is this supervision session awaiting a signature?" predicate.
 *
 * Single source of truth so the supervisee detail SessionLog, the supervisor
 * roster KPIs, and any future surface that needs to surface pending-sign
 * state stay in sync. Mirrors the inline filter in
 * `computeRosterCompliance.pendingSignatureCount` and `pendingSignaturesForUser`.
 *
 * A session is pending signature when:
 *   - kind === "supervision" (practice events don't co-sign)
 *   - signedAt is null (not yet sealed)
 *   - scheduledStatus is not "canceled" or "no_show" (the row no longer
 *     represents a sign-able event)
 *   - meeting END time has passed (start + duration <= now)
 *
 * Per-user signing state (`signatures[].signerId === userId`) is layered
 * on top by `pendingSignaturesForUser` for the supervisee dashboard; the
 * session-log view shows "needs somebody's signature" so it does NOT
 * filter by viewer.
 */

export type PendingCandidate = {
  kind: string;
  signedAt: Date | string | null;
  scheduledStatus?: string | null;
  date: Date | string;
  durationHours: number;
};

export function isSessionPendingSignature(
  event: PendingCandidate,
  now: Date = new Date()
): boolean {
  if (event.kind !== "supervision") return false;
  if (event.signedAt !== null && event.signedAt !== undefined) return false;
  if (event.scheduledStatus === "canceled") return false;
  if (event.scheduledStatus === "no_show") return false;
  const startMs =
    event.date instanceof Date
      ? event.date.getTime()
      : Date.parse(String(event.date));
  if (!Number.isFinite(startMs)) return false;
  const endMs = startMs + (event.durationHours ?? 0) * 60 * 60_000;
  return endMs <= now.getTime();
}
