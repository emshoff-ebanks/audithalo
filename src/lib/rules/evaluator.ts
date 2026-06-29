import { runCheck } from "./checks";
import type {
  EvaluationContext,
  EvaluationResult,
  EvaluationTotals,
  Gap,
  RiskLevel,
  Rule,
  SessionEvent,
} from "./types";
import { ruleId } from "./types";

/** Cadence checks that pause when the supervisee is on_leave. See
 *  docs/strategy/13-paycor-integration.md §2A. */
const PAUSED_WHEN_ON_LEAVE = new Set([
  "individual_supervision_cadence",
  "weekly_supervision_cadence",
]);

function computeTotals(sessions: SessionEvent[]): EvaluationTotals {
  let practice = 0;
  let supervision = 0;
  let individual = 0;
  let triadic = 0;
  let group = 0;
  for (const s of sessions) {
    if (s.kind === "practice") {
      practice += s.durationHours;
    } else {
      supervision += s.durationHours;
      if (s.sessionType === "individual") individual += s.durationHours;
      else if (s.sessionType === "triadic") triadic += s.durationHours;
      else group += s.durationHours;
    }
  }
  return {
    practiceHours: practice,
    supervisionHours: supervision,
    individualSupervisionHours: individual,
    triadicSupervisionHours: triadic,
    groupSupervisionHours: group,
  };
}

function computeRisk(
  gaps: Gap[],
  practicePct: number,
  supervisionPct: number
): RiskLevel {
  if (gaps.some((g) => g.severity === "blocker")) return "red";
  if (gaps.some((g) => g.severity === "warning")) return "yellow";
  if (practicePct >= 100 && supervisionPct >= 100) return "green";
  return "green";
}

/**
 * Evaluates a supervisee's hour log against a rule.
 * Pure function. Same input → same output.
 */
export function evaluate(
  ctx: EvaluationContext,
  rule: Rule
): EvaluationResult {
  const totals = computeTotals(ctx.sessions);

  const practicePct = Math.min(
    100,
    (totals.practiceHours / rule.structured.total_practice_hours_required) * 100
  );
  const supervisionPct = Math.min(
    100,
    (totals.supervisionHours /
      rule.structured.total_supervision_hours_required) *
      100
  );

  const isPaused = ctx.leaveStatus === "on_leave";
  const gaps: Gap[] = [];
  for (const check of rule.checks) {
    if (isPaused && PAUSED_WHEN_ON_LEAVE.has(check.id)) continue;
    gaps.push(...runCheck(ctx, rule, check));
  }

  const compliant = !gaps.some((g) => g.severity === "blocker");

  return {
    ruleId: ruleId(rule),
    evaluatedAt: ctx.asOf ?? new Date().toISOString(),
    totals,
    progress: {
      practiceProgressPct: practicePct,
      supervisionProgressPct: supervisionPct,
    },
    compliant,
    riskLevel: computeRisk(gaps, practicePct, supervisionPct),
    gaps,
    paused: isPaused,
  };
}
