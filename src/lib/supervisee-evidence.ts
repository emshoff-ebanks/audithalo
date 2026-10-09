/**
 * Pure merge/sort for the supervisee "Recently sealed" panel
 * (see docs/App changes/handoff-05-supervisee-page.md §6).
 *
 * Combines this supervisee's sealed evidence packages with their sessions
 * still awaiting a signature, newest-first, capped to a handful of rows.
 * DB access lives in the dashboard; this module is pure so the ordering is
 * unit-testable.
 */

export type SealedEvidenceItem = {
  sessionId: string;
  /** Evidence package id — the row's PDF link points at /api/evidence/<id>. */
  packageId: string;
  documentHash: string;
  sealedAt: Date;
  sessionDate: Date;
};

export type PendingSignatureItem = {
  sessionId: string;
  sessionDate: Date;
  /** True when the supervisee themselves must sign next (row links to /sign). */
  awaitingSelf: boolean;
};

export type RecentEvidenceRow =
  | ({ type: "sealed" } & SealedEvidenceItem)
  | ({ type: "pending" } & PendingSignatureItem);

/** Session date drives the ordering for both kinds — it's what the row shows. */
function sortMs(row: RecentEvidenceRow): number {
  return row.sessionDate.getTime();
}

export function mergeRecentEvidence(
  sealed: SealedEvidenceItem[],
  pending: PendingSignatureItem[],
  limit = 4
): RecentEvidenceRow[] {
  const rows: RecentEvidenceRow[] = [
    ...sealed.map((s) => ({ type: "sealed" as const, ...s })),
    ...pending.map((p) => ({ type: "pending" as const, ...p })),
  ];
  rows.sort((a, b) => sortMs(b) - sortMs(a));
  return rows.slice(0, limit);
}
