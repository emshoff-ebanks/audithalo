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
    /** Two-letter state code. When undefined, treat as supervisee's current state. */
    practiceState: z.string().length(2).optional(),
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

/** Lifecycle state — see docs/strategy/13-paycor-integration.md §2A.
 *  When `on_leave`, cadence checks (individual_supervision_cadence,
 *  weekly_supervision_cadence) are skipped and the result carries
 *  `paused: true` so consumers can render a banner. PRN has no
 *  evaluation effect (badge-only). Optional in the context — callers
 *  that don't pass it are treated as 'active' by the evaluator.
 */
export const leaveStatusSchema = z
  .enum(["active", "on_leave", "prn"])
  .optional();
export type EvaluationLeaveStatus = z.infer<typeof leaveStatusSchema>;

export const evaluationContextSchema = z.object({
  superviseeId: z.string(),
  /** When the supervision obligation began. */
  startedAt: z.string(),
  /** When the supervision contract was filed with the board (NC requires before any hour counts). */
  supervisionContractFiledAt: z.string().optional(),
  /** Attested permit expiry — when set, permit_expiration_window uses this
   *  directly instead of inferring from startedAt + max_months. Useful for
   *  CA APCC where the BBS issues a permit with an explicit expiry date that
   *  may not align with the obligation-start + max-months math. */
  permitExpiresAt: z.string().optional(),
  /** Hour log to date, oldest first. */
  sessions: z.array(sessionEventSchema),
  /** Evaluation moment ("now") — overridable for testing. Defaults to current time. */
  asOf: z.string().optional(),
  /** Supervisee's current lifecycle state. Defaults to 'active'. */
  leaveStatus: leaveStatusSchema,
});
export type EvaluationContext = z.infer<typeof evaluationContextSchema>;

// ============================================================================
// Evaluation result (what the evaluator returns)
// ============================================================================

/**
 * What kind of next-action a gap surfaces to the UI.
 *
 *  - attestation        — a one-click "mark this fact as true" (with optional value)
 *  - recurring_behavior — "log another session"; ongoing supervisor behavior
 *  - data_correction    — existing data is wrong; point at the offending records
 *  - data_accumulation  — supervisee just needs more hours; show progress, no CTA
 *  - time_warning       — time-based; show countdown, no CTA
 */
export type GapActionKind =
  | "attestation"
  | "recurring_behavior"
  | "data_correction"
  | "data_accumulation"
  | "time_warning";

export type GapAction =
  | {
      kind: "attestation";
      checkId: string;
      /** Typed column on the assignment row (e.g. supervisionContractFiledAt). */
      signalField: string;
      actionLabel: string;
      helpText?: string;
      valueShape: "date" | "date_and_hours";
    }
  | {
      kind: "recurring_behavior";
      actionLabel: string;
      helpText?: string;
      targetSessionType: "individual" | "any_supervision";
    }
  | {
      kind: "data_correction";
      actionLabel: string;
      helpText?: string;
      targetSessionIds: string[];
    }
  | {
      kind: "data_accumulation";
      helpText?: string;
      progressTowards: { logged: number; required: number; unit: string };
    }
  | {
      kind: "time_warning";
      helpText?: string;
      daysRemaining: number;
      isOverdue: boolean;
    };

export type Gap = {
  code: string;
  severity: RuleSeverity;
  message: string;
  detail?: Record<string, unknown>;
  action: GapAction;
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
  /** True when leaveStatus === 'on_leave' caused cadence checks to be
   *  skipped. UI surfaces should render a "Paused — on leave" banner
   *  and exclude the supervisee from at-risk counts. */
  paused?: boolean;
};
