import type { schema } from "@/lib/db";

type SessionEvent = typeof schema.sessionEvents.$inferSelect;

/**
 * Pure helper for the supervisee dashboard.
 *
 * Returns the supervision sessions that are awaiting THIS user's signature —
 * i.e. supervision events that are not yet fully sealed (`signedAt` is null)
 * and where this user has not yet appeared in the `signatures` array.
 *
 * Practice events are excluded; they don't require a co-signature.
 */
export function pendingSignaturesForUser(
  events: SessionEvent[],
  userId: string
): SessionEvent[] {
  return events.filter(
    (e) =>
      e.kind === "supervision" &&
      !e.signedAt &&
      !(e.signatures ?? []).some((s) => s.signerId === userId)
  );
}
