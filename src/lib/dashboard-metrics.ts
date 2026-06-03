import type { RosterRow } from "@/lib/db/roster-queries";

export type OrgMetrics = {
  totalSupervisees: number;
  /** Has rule assigned + evaluation succeeded */
  withEvaluation: number;
  /** Green risk level */
  onTrack: number;
  /** Yellow risk level */
  needsAttention: number;
  /** Red risk level */
  atRisk: number;
  /** No rule assigned yet */
  unassigned: number;
  /** Sum of pendingSignatureCount across roster */
  totalPendingSignatures: number;
  /** Sum of practice hours across all supervisees */
  totalPracticeHours: number;
  /** Sum of supervision hours */
  totalSupervisionHours: number;
  /** % of supervisees in green (computed from withEvaluation, not totalSupervisees, so unassigned doesn't drag it down). 0 if no evaluable supervisees. */
  complianceScorePct: number;
};

export function computeOrgMetrics(roster: RosterRow[]): OrgMetrics {
  let onTrack = 0;
  let needsAttention = 0;
  let atRisk = 0;
  let unassigned = 0;
  let totalPendingSignatures = 0;
  let totalPracticeHours = 0;
  let totalSupervisionHours = 0;
  let withEvaluation = 0;

  for (const r of roster) {
    totalPendingSignatures += r.pendingSignatureCount;
    if (r.evaluation === null) {
      unassigned += 1;
      continue;
    }
    withEvaluation += 1;
    totalPracticeHours += r.evaluation.totals.practiceHours;
    totalSupervisionHours += r.evaluation.totals.supervisionHours;
    if (r.evaluation.riskLevel === "green") onTrack += 1;
    else if (r.evaluation.riskLevel === "yellow") needsAttention += 1;
    else if (r.evaluation.riskLevel === "red") atRisk += 1;
  }

  const complianceScorePct =
    withEvaluation > 0 ? Math.round((onTrack / withEvaluation) * 100) : 0;

  return {
    totalSupervisees: roster.length,
    withEvaluation,
    onTrack,
    needsAttention,
    atRisk,
    unassigned,
    totalPendingSignatures,
    totalPracticeHours,
    totalSupervisionHours,
    complianceScorePct,
  };
}

/** Bottom N at-risk supervisees (red first, then yellow). Used by both HR and Exec dashboards. */
export function bottomAtRisk(roster: RosterRow[], n: number = 5): RosterRow[] {
  const severityRank = (r: RosterRow): number => {
    if (r.evaluation?.riskLevel === "red") return 0;
    if (r.evaluation?.riskLevel === "yellow") return 1;
    return 2;
  };
  return [...roster]
    .filter((r) => r.evaluation?.riskLevel !== "green")
    .filter((r) => r.evaluation !== null) // exclude unassigned
    .sort((a, b) => {
      const rankDiff = severityRank(a) - severityRank(b);
      if (rankDiff !== 0) return rankDiff;
      // Tiebreak: lower practice progress first
      const aPct = a.evaluation?.progress.practiceProgressPct ?? 0;
      const bPct = b.evaluation?.progress.practiceProgressPct ?? 0;
      return aPct - bPct;
    })
    .slice(0, n);
}
