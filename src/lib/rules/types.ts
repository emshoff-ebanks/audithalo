import { z } from "zod";

// ============================================================================
// Rule schema (validates YAML files in /rules/*.yaml)
// ============================================================================

export const ruleSeveritySchema = z.enum(["info", "warning", "blocker"]);
export type RuleSeverity = z.infer<typeof ruleSeveritySchema>;

export const ruleCitationSchema = z.object({
  admincode: z.string(),
  statute: z.string().optional(),
  url: z.string().url(),
});
export type RuleCitation = z.infer<typeof ruleCitationSchema>;

/** Accept either an ISO string or a Date (js-yaml auto-parses unquoted YYYY-MM-DD as Date) and normalize to ISO string. */
const dateLike = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString() : v));

const dateLikeNullable = z
  .union([z.string(), z.date(), z.null()])
  .transform((v) =>
    v === null ? null : v instanceof Date ? v.toISOString() : v
  );

export const ruleVerificationSchema = z.object({
  last_verified_at: dateLike,
  last_verified_by: z.string(),
  source_hash: z.string(),
});

export const ruleStructuredSchema = z
  .object({
    total_practice_hours_required: z.number().positive(),
    total_supervision_hours_required: z.number().positive(),
    min_duration_months: z.number().int().nonnegative().optional(),
    max_duration_months: z.number().int().positive().optional(),
    group_max_attendees: z.number().int().positive().optional(),
    min_individual_supervision_fraction: z.number().min(0).max(1).optional(),
  })
  .strict();
export type RuleStructured = z.infer<typeof ruleStructuredSchema>;

export const ruleCheckSchema = z.object({
  id: z.string(),
  severity: ruleSeveritySchema,
  description: z.string(),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type RuleCheck = z.infer<typeof ruleCheckSchema>;

export const ruleEvidenceSchema = z.object({
  form_template_key: z.string(),
  required_signers: z.array(z.string()).min(1),
  required_artifacts: z.array(z.string()),
  optional_artifacts: z.array(z.string()).default([]),
  immutability: z.string(),
});

export const ruleFaqItemSchema = z.object({
  q: z.string(),
  a: z.string(),
});

export const rulePageContentSchema = z.object({
  intro: z.string().optional(),
  supervisor_qualifications: z.array(z.string()).optional(),
  key_warnings: z.array(z.string()).optional(),
  faq: z.array(ruleFaqItemSchema).optional(),
}).optional();

export const ruleSchema = z
  .object({
    jurisdiction: z.string().length(2),
    license_code: z.string().min(2),
    license_name: z.string(),
    issuing_board: z.string(),
    version: z.number().int().positive(),
    summary: z.string(),
    effective_start: dateLike,
    effective_end: dateLikeNullable,
    citation: ruleCitationSchema,
    verification: ruleVerificationSchema,
    structured: ruleStructuredSchema,
    checks: z.array(ruleCheckSchema),
    evidence_requirements: ruleEvidenceSchema,
    notes: z.array(z.string()).default([]),
    page_content: rulePageContentSchema,
  })
  .strict();
export type Rule = z.infer<typeof ruleSchema>;

/** A stable identifier — "{jurisdiction}-{license_code}-v{version}" */
export function ruleId(r: Rule): string {
  return `${r.jurisdiction}-${r.license_code}-v${r.version}`.toLowerCase();
}

// ============================================================================
// Evaluation context (the supervisee's logged hours fed to the evaluator)
// ============================================================================

export const sessionEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("practice"),
    id: z.string(),
    date: z.string(),
    durationHours: z.number().positive(),
    /** Direct client contact hours; defaults to durationHours when not specified. */
    directContactHours: z.number().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal("supervision"),
    id: z.string(),
    date: z.string(),
    durationHours: z.number().positive(),
    sessionType: z.enum(["individual", "triadic", "group"]),
    supervisorCredentials: z.array(z.string()).default([]),
    groupAttendees: z.number().int().positive().optional(),
    /** Supervisor's verified training hours at the time this session was logged. */
    supervisorTrainingHours: z.number().int().nonnegative().optional(),
  }),
]);
export type SessionEvent = z.infer<typeof sessionEventSchema>;

export const evaluationContextSchema = z.object({
  superviseeId: z.string(),
  /** When the supervision obligation began. */
  startedAt: z.string(),
  /** When the supervision contract was filed with the board (NC requires before any hour counts). */
  supervisionContractFiledAt: z.string().optional(),
  /** Hour log to date, oldest first. */
  sessions: z.array(sessionEventSchema),
  /** Evaluation moment ("now") — overridable for testing. Defaults to current time. */
  asOf: z.string().optional(),
});
export type EvaluationContext = z.infer<typeof evaluationContextSchema>;

// ============================================================================
// Evaluation result (what the evaluator returns)
// ============================================================================

export type Gap = {
  code: string;
  severity: RuleSeverity;
  message: string;
  detail?: Record<string, unknown>;
};

export type RiskLevel = "green" | "yellow" | "red";

export type EvaluationTotals = {
  practiceHours: number;
  supervisionHours: number;
  individualSupervisionHours: number;
  triadicSupervisionHours: number;
  groupSupervisionHours: number;
};

export type EvaluationProgress = {
  practiceProgressPct: number;
  supervisionProgressPct: number;
};

export type EvaluationResult = {
  ruleId: string;
  evaluatedAt: string;
  totals: EvaluationTotals;
  progress: EvaluationProgress;
  /** No blocker-severity gaps. */
  compliant: boolean;
  riskLevel: RiskLevel;
  gaps: Gap[];
};
