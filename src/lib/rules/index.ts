export { evaluate } from "./evaluator";
export {
  getRule,
  listRuleIds,
  loadAllRules,
  ruleSlug,
  parseSlug,
  getLatestRuleByJurLic,
  listLatestRules,
  parseRuleId,
  latestVersionForState,
} from "./loader";
export {
  severityStyles,
  toneClasses,
  riskBadgeVariant,
  riskBadgeLabel,
} from "./presentation";
export { resolveEvaluation } from "./evaluation-context";
export type { ResolvedEvaluation } from "./evaluation-context";
export {
  buildCustomRule,
  customRuleId,
  isCustomRuleId,
  mergeOverride,
  orgIdFromCustomRuleId,
} from "./overrides";
export type { OverrideRow } from "./overrides";
// resolveEvaluationWithOverrides intentionally NOT exported from the barrel
// — it transitively imports the Drizzle client, which would pull
// DATABASE_URL into every test/cron path that touches @/lib/rules. Import
// it directly from "@/lib/rules/evaluation-context-with-overrides".
export type {
  EvaluationContext,
  EvaluationResult,
  EvaluationTotals,
  EvaluationProgress,
  Gap,
  RiskLevel,
  Rule,
  RuleCheck,
  RuleSeverity,
  SessionEvent,
} from "./types";
export { ruleId } from "./types";
