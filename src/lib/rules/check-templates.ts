/**
 * The seven check-template catalog for the custom-state builder (Cycle 4).
 *
 * Why a catalog instead of free-form check authoring? Because the evaluator
 * in checks.ts only knows about a fixed set of check IDs; an HR Admin who
 * could pick any ID would be writing code the evaluator can't execute. The
 * templates wrap that fixed set in UI-friendly building blocks: an HR Admin
 * picks a primitive ("total hours") and a sub-kind ("practice"), the form
 * collects the required params, and the builder emits a RuleCheck whose
 * `id` matches a canonical-evaluator entry one-for-one.
 *
 * If a state needs an eighth primitive, that's a signal to ship it as a
 * canonical rule (and a new evaluator function), not to extend the catalog.
 *
 * See docs/strategy/09-rules-admin.md §"The check template catalog".
 */

import type { RuleCheck, RuleSeverity } from "./types";

export type CheckTemplateKey =
  | "total_hours"
  | "supervision_ratio"
  | "cadence"
  | "group_cap"
  | "attestation"
  | "time_window"
  | "permit_window";

/** Which canonical evaluator IDs each template can resolve to. The wizard
 *  exposes the sub-kind picker only when a template has multiple options. */
export const TEMPLATE_SUBKINDS: Record<CheckTemplateKey, string[]> = {
  total_hours: ["practice", "supervision", "direct"],
  supervision_ratio: ["ratio_per_block", "min_share"],
  cadence: ["biweekly", "weekly"],
  group_cap: ["default"],
  attestation: ["contract_filed", "supervisor_training"],
  time_window: ["default"],
  permit_window: ["default"],
};

export type CheckTemplateInstance = {
  templateKey: CheckTemplateKey;
  subKind: string;
  severity: RuleSeverity;
  description: string;
  params: Record<string, number>;
};

/** Default severity per template. The wizard pre-fills this; the HR Admin
 *  can soften or strengthen it before saving. */
export const TEMPLATE_DEFAULT_SEVERITY: Record<CheckTemplateKey, RuleSeverity> = {
  total_hours: "info",
  supervision_ratio: "warning",
  cadence: "warning",
  group_cap: "blocker",
  attestation: "blocker",
  time_window: "warning",
  permit_window: "warning",
};

type SubKindDefinition = {
  /** Canonical evaluator id this sub-kind emits. Must match CHECK_REGISTRY
   *  in src/lib/rules/checks.ts. */
  evaluatorId: string;
  /** Human-readable label shown in the wizard sub-kind picker. */
  label: string;
  /** Params the wizard collects, in display order. */
  params: Array<{
    key: string;
    label: string;
    /** Sensible default — the wizard pre-fills the input with this value. */
    default: number;
    min?: number;
    max?: number;
    /** Render hint: integer-only vs free decimal. */
    integer?: boolean;
    helpText?: string;
  }>;
  /** Default description string. The wizard's description field is editable;
   *  this seeds it. */
  defaultDescription: string;
};

type TemplateCatalog = {
  [K in CheckTemplateKey]: {
    label: string;
    helpText: string;
    subKinds: Record<string, SubKindDefinition>;
  };
};

export const TEMPLATE_CATALOG: TemplateCatalog = {
  total_hours: {
    label: "Total hours",
    helpText:
      "A simple total — practice, supervision, or direct client contact hours required across the obligation.",
    subKinds: {
      practice: {
        evaluatorId: "total_practice_hours",
        label: "Practice hours",
        params: [
          { key: "required", label: "Hours required", default: 3000, min: 1, integer: true },
        ],
        defaultDescription: "Total supervised practice hours required.",
      },
      supervision: {
        evaluatorId: "total_supervision_hours",
        label: "Supervision hours",
        params: [
          { key: "required", label: "Hours required", default: 100, min: 1, integer: true },
        ],
        defaultDescription: "Total supervision hours required.",
      },
      direct: {
        evaluatorId: "direct_client_contact_minimum",
        label: "Direct client contact hours",
        params: [
          { key: "required", label: "Direct contact hours required", default: 1500, min: 1, integer: true },
        ],
        defaultDescription: "Minimum direct client contact hours.",
      },
    },
  },
  supervision_ratio: {
    label: "Supervision ratio",
    helpText:
      "Either a per-block ratio (every N practice hours needs X supervision) or a minimum individual share of total supervision.",
    subKinds: {
      ratio_per_block: {
        evaluatorId: "supervision_ratio_per_practice_block",
        label: "Per-block ratio",
        params: [
          { key: "practice_hours_per_block", label: "Practice hours per block", default: 40, min: 1, integer: true },
          { key: "individual_hours_required", label: "Individual hours required per block", default: 1, min: 0 },
          { key: "group_hours_required", label: "Group hours required per block (alternative)", default: 2, min: 0 },
        ],
        defaultDescription:
          "Each block of practice hours must be matched by the required individual or group supervision.",
      },
      min_share: {
        evaluatorId: "individual_supervision_minimum_share",
        label: "Minimum individual share",
        params: [
          { key: "min_individual_fraction", label: "Minimum individual fraction (0-1)", default: 0.75, min: 0, max: 1 },
          { key: "enforce_after_practice_hours", label: "Enforce after this many practice hours", default: 0, min: 0, integer: true },
        ],
        defaultDescription:
          "Individual supervision must make up at least the configured fraction of total supervision.",
      },
    },
  },
  cadence: {
    label: "Supervision cadence",
    helpText:
      "Recurring supervision behavior — either a max-gap-between-individual-sessions or a weekly threshold.",
    subKinds: {
      biweekly: {
        evaluatorId: "individual_supervision_cadence",
        label: "Max gap between individual sessions",
        params: [
          { key: "max_gap_days", label: "Maximum gap (days)", default: 14, min: 1, integer: true },
          { key: "min_hours_per_period", label: "Minimum hours per period", default: 1, min: 0 },
        ],
        defaultDescription: "Individual supervision must occur within the configured rolling window.",
      },
      weekly: {
        evaluatorId: "weekly_supervision_cadence",
        label: "Weekly threshold",
        params: [
          { key: "min_direct_hours_threshold", label: "Practice-hours-per-week threshold", default: 20, min: 0, integer: true },
          { key: "min_individual_hours_per_week", label: "Min individual/triadic hours that week", default: 1, min: 0 },
        ],
        defaultDescription:
          "Any ISO week exceeding the practice-hour threshold needs the required individual or triadic supervision in the same week.",
      },
    },
  },
  group_cap: {
    label: "Group session attendee cap",
    helpText: "Maximum attendees per group supervision session.",
    subKinds: {
      default: {
        evaluatorId: "group_size_limit",
        label: "Group size limit",
        params: [
          { key: "max_attendees", label: "Max attendees", default: 8, min: 2, integer: true },
        ],
        defaultDescription: "Group supervision sessions may not exceed the configured attendee cap.",
      },
    },
  },
  attestation: {
    label: "Attestation",
    helpText:
      "A one-time fact the supervisor confirms — either the supervision contract is filed, or the supervisor's training is complete.",
    subKinds: {
      contract_filed: {
        evaluatorId: "pre_registration_required",
        label: "Supervision contract filed",
        params: [],
        defaultDescription:
          "Supervision contract must be filed with the board before any hour can count.",
      },
      supervisor_training: {
        evaluatorId: "supervisor_training_course_required",
        label: "Supervisor training complete",
        params: [
          { key: "min_training_hours", label: "Min training hours", default: 30, min: 1, integer: true },
        ],
        defaultDescription:
          "Supervisor must have completed the required training hours at the time of each session.",
      },
    },
  },
  time_window: {
    label: "Obligation window",
    helpText: "Min and max months the supervisee has to complete the obligation.",
    subKinds: {
      default: {
        evaluatorId: "duration_window",
        label: "Duration window",
        params: [
          { key: "min_months", label: "Minimum months", default: 24, min: 0, integer: true },
          { key: "max_months", label: "Maximum months", default: 60, min: 1, integer: true },
        ],
        defaultDescription:
          "The obligation must complete within the configured window of months.",
      },
    },
  },
  permit_window: {
    label: "Permit / registration expiry",
    helpText:
      "How long a permit or registration is valid from issuance, with a configurable warning window before expiry.",
    subKinds: {
      default: {
        evaluatorId: "permit_expiration_window",
        label: "Permit expiry",
        params: [
          { key: "max_months", label: "Months until expiry", default: 36, min: 1, integer: true },
          { key: "warning_window_days", label: "Warn this many days before", default: 90, min: 0, integer: true },
        ],
        defaultDescription:
          "Permit or registration expires after the configured number of months; warn this many days before expiry.",
      },
    },
  },
};

/** Convert one template instance into the RuleCheck the evaluator will run.
 *  The instance's params are passed straight through — the wizard is
 *  responsible for capturing the keys the sub-kind expects (validated by
 *  validateInstance below). */
export function buildRuleCheckFromInstance(
  instance: CheckTemplateInstance
): RuleCheck {
  const subKind = TEMPLATE_CATALOG[instance.templateKey].subKinds[instance.subKind];
  if (!subKind) {
    throw new Error(
      `Unknown sub-kind '${instance.subKind}' for template '${instance.templateKey}'`
    );
  }
  return {
    id: subKind.evaluatorId,
    severity: instance.severity,
    description: instance.description.trim() || subKind.defaultDescription,
    params: { ...instance.params },
  };
}

/** Throws when the instance references a missing template/sub-kind, is missing
 *  a required param, or has a param outside the catalog's allowed range. */
export function validateInstance(instance: CheckTemplateInstance): void {
  const template = TEMPLATE_CATALOG[instance.templateKey];
  if (!template) {
    throw new Error(`Unknown template '${instance.templateKey}'`);
  }
  const subKind = template.subKinds[instance.subKind];
  if (!subKind) {
    throw new Error(
      `Unknown sub-kind '${instance.subKind}' for template '${instance.templateKey}'`
    );
  }
  for (const def of subKind.params) {
    const v = instance.params[def.key];
    if (v === undefined || Number.isNaN(v)) {
      throw new Error(
        `Missing '${def.key}' for ${instance.templateKey}/${instance.subKind}`
      );
    }
    if (def.min !== undefined && v < def.min) {
      throw new Error(
        `'${def.key}' for ${instance.templateKey}/${instance.subKind} must be ≥ ${def.min}`
      );
    }
    if (def.max !== undefined && v > def.max) {
      throw new Error(
        `'${def.key}' for ${instance.templateKey}/${instance.subKind} must be ≤ ${def.max}`
      );
    }
    if (def.integer && !Number.isInteger(v)) {
      throw new Error(
        `'${def.key}' for ${instance.templateKey}/${instance.subKind} must be an integer`
      );
    }
  }
}
