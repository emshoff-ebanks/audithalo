import type { schema } from "@/lib/db";
import { evaluate } from "./evaluator";
import { getRule } from "./loader";
import type { EvaluationContext, EvaluationResult, Rule } from "./types";

type Assignment = typeof schema.superviseeRuleAssignments.$inferSelect;
type SessionEvent = typeof schema.sessionEvents.$inferSelect;

export type ResolvedEvaluation = {
  rule: Rule;
  evaluation: EvaluationResult;
};

/**
 * Pure helper: given a supervisee's rule assignment and their logged session
 * events, resolve the rule from the registry and run the evaluator.
 *
 * Returns null when the rule cannot be resolved — either the `ruleId` field
 * doesn't match the `{jur}-{lic}-v{version}` shape, or the registry has no
 * such rule. Callers can render a "no rule" UI in that case.
 */
export function resolveEvaluation(
  assignment: Assignment,
  events: SessionEvent[],
  asOf: Date = new Date()
): ResolvedEvaluation | null {
  const [, jur, lic, vRaw] =
    assignment.ruleId.match(/^(.+?)-(.+?)-v(\d+)$/) ?? [];
  if (!jur || !lic || !vRaw) return null;

  let rule: Rule;
  try {
    rule = getRule(jur.toUpperCase(), lic.toUpperCase(), parseInt(vRaw, 10));
  } catch {
    return null;
  }

  const ctx: EvaluationContext = {
    superviseeId: assignment.superviseeId,
    startedAt: assignment.obligationStartedAt.toISOString(),
    supervisionContractFiledAt:
      assignment.supervisionContractFiledAt?.toISOString(),
    sessions: events.map((e) =>
      e.kind === "practice"
        ? {
            kind: "practice" as const,
            id: e.id,
            date: e.date.toISOString(),
            durationHours: e.durationHours,
            directContactHours: e.directContactHours ?? undefined,
          }
        : {
            kind: "supervision" as const,
            id: e.id,
            date: e.date.toISOString(),
            durationHours: e.durationHours,
            sessionType:
              (e.sessionType as "individual" | "triadic" | "group") ??
              "individual",
            supervisorCredentials:
              (e.supervisorCredentials as string[]) ?? [],
            groupAttendees: e.groupAttendees ?? undefined,
            supervisorTrainingHours:
              e.supervisorTrainingHours ?? undefined,
          }
    ),
    asOf: asOf.toISOString(),
  };

  return { rule, evaluation: evaluate(ctx, rule) };
}
