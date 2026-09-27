/**
 * "Notes waiting on YOUR signature" — the per-signer pending-signature
 * query behind the supervisor overview hero and the Signature queue page.
 *
 * Deliberately NOT the same as `RosterRow.pendingSignatureCount` (from
 * getOrgRosterWithCompliance): that counts every unsigned past supervision
 * session per supervisee regardless of who must sign, so it over-reports
 * for a specific supervisor. This module answers the narrower question
 * "which sessions is THIS supervisor still a required signer on, and hasn't
 * signed yet?"
 *
 * A session is "waiting on this supervisor" when:
 *   1. it is pending signature at all — mirror `isSessionPendingSignature`
 *      (kind supervision, signedAt null, not canceled/no-show, meeting END
 *      time has passed), and
 *   2. this supervisor has NOT already signed it, and
 *   3. this supervisor is a REQUIRED signer — the original logger
 *      (loggedById) OR the active assigned supervisor of the supervisee.
 *      This mirrors the server authz in src/app/actions/signatures.ts and
 *      the sign page in src/app/app/sign/[sessionId]/page.tsx.
 *
 * The filtering is a pure function (unit-tested without a DB); the DB
 * function just fetches the candidate rows and hands them to it.
 */

import { cache } from "react";
import { isSessionPendingSignature } from "@/lib/session-pending";
import type { SessionSignature } from "@/lib/db/schema";

export type PendingSignatureRow = {
  sessionId: string;
  superviseeId: string;
  superviseeName: string;
  date: Date;
  sessionType: string | null;
};

/** Candidate shape fed to the pure filter. Superset of what
 *  isSessionPendingSignature needs plus the required-signer fields. */
export type SupervisorSignCandidate = {
  sessionId: string;
  superviseeId: string;
  superviseeName: string;
  date: Date;
  sessionType: string | null;
  durationHours: number;
  kind: string;
  loggedById: string;
  signatures: SessionSignature[] | null;
  signedAt: Date | null;
  scheduledStatus: string | null;
};

/**
 * Pure: reduce the candidate sessions to the ones this supervisor still
 * owes a signature on, oldest session first.
 *
 * `assignedSuperviseeIds` = the supervisees this supervisor is the active
 * assigned supervisor for. A candidate qualifies when it is pending
 * signature, the supervisor hasn't already signed, AND the supervisor is a
 * required signer (original logger OR active assigned supervisor).
 */
export function filterPendingSignaturesForSupervisor(
  candidates: SupervisorSignCandidate[],
  supervisorId: string,
  assignedSuperviseeIds: ReadonlySet<string>,
  now: Date = new Date()
): PendingSignatureRow[] {
  return candidates
    .filter((c) => {
      if (!isSessionPendingSignature(c, now)) return false;
      const alreadySigned = (c.signatures ?? []).some(
        (s) => s.signerId === supervisorId
      );
      if (alreadySigned) return false;
      const isRequiredSigner =
        c.loggedById === supervisorId ||
        assignedSuperviseeIds.has(c.superviseeId);
      return isRequiredSigner;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((c) => ({
      sessionId: c.sessionId,
      superviseeId: c.superviseeId,
      superviseeName: c.superviseeName,
      date: c.date,
      sessionType: c.sessionType,
    }));
}

/**
 * DB helper: the pending-to-sign sessions for one supervisor in one org,
 * oldest first. Wrapped in React `cache()` so the dashboard hero and the
 * nav-count resolver in the layout share a single query per request.
 *
 * Scope: the supervisor's actively-assigned supervisees plus any session
 * they personally logged — the exact set the required-signer predicate can
 * match. Called only for the `supervisor` role (HR Admin never signs).
 */
export const pendingSignaturesForSupervisor = cache(
  async (
    supervisorId: string,
    orgId: string
  ): Promise<PendingSignatureRow[]> => {
    const [{ db, schema }, { and, eq, inArray, isNull, or }] =
      await Promise.all([import("@/lib/db"), import("drizzle-orm")]);

    const assignmentRows = await db
      .select({ superviseeId: schema.supervisorAssignments.superviseeId })
      .from(schema.supervisorAssignments)
      .where(
        and(
          eq(schema.supervisorAssignments.supervisorId, supervisorId),
          eq(schema.supervisorAssignments.orgId, orgId),
          isNull(schema.supervisorAssignments.endedAt)
        )
      );
    const assignedIds = assignmentRows
      .map((r) => r.superviseeId)
      .filter((id): id is string => id !== null);

    // Fetch the required-signer candidate set: sessions for assigned
    // supervisees OR sessions this supervisor logged. drizzle drops the
    // undefined branch, so an empty roster falls back to loggedById only.
    const scopeFilter = or(
      assignedIds.length > 0
        ? inArray(schema.sessionEvents.superviseeId, assignedIds)
        : undefined,
      eq(schema.sessionEvents.loggedById, supervisorId)
    );

    const rows = await db
      .select({
        sessionId: schema.sessionEvents.id,
        superviseeId: schema.sessionEvents.superviseeId,
        superviseeName: schema.users.name,
        superviseeEmail: schema.users.email,
        date: schema.sessionEvents.date,
        sessionType: schema.sessionEvents.sessionType,
        durationHours: schema.sessionEvents.durationHours,
        kind: schema.sessionEvents.kind,
        loggedById: schema.sessionEvents.loggedById,
        signatures: schema.sessionEvents.signatures,
        signedAt: schema.sessionEvents.signedAt,
        scheduledStatus: schema.sessionEvents.scheduledStatus,
      })
      .from(schema.sessionEvents)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.sessionEvents.superviseeId)
      )
      .where(
        and(
          eq(schema.sessionEvents.orgId, orgId),
          eq(schema.sessionEvents.kind, "supervision"),
          isNull(schema.sessionEvents.signedAt),
          scopeFilter
        )
      );

    const candidates: SupervisorSignCandidate[] = rows.map((r) => ({
      sessionId: r.sessionId,
      superviseeId: r.superviseeId as string,
      superviseeName: r.superviseeName ?? r.superviseeEmail,
      date: r.date,
      sessionType: r.sessionType,
      durationHours: r.durationHours,
      kind: r.kind,
      loggedById: r.loggedById,
      signatures: r.signatures,
      signedAt: r.signedAt,
      scheduledStatus: r.scheduledStatus,
    }));

    return filterPendingSignaturesForSupervisor(
      candidates,
      supervisorId,
      new Set(assignedIds)
    );
  }
);
