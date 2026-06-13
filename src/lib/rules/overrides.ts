/**
 * Override + custom-rule merge helpers.
 *
 * Pure functions over JSON — no DB, no FS. The resolver in
 * evaluation-context.ts is responsible for loading the canonical rule and
 * the override row from their respective sources and handing them here.
 *
 * See docs/strategy/09-rules-admin.md for the two-tier model and the seven
 * check templates that the custom-state builder composes against.
 */

import type {
  ChecksCustomPatch,
  ChecksOverridePatch,
  CustomRuleMetadata,
  RuleStructuredPatch,
} from "@/lib/db/schema";
import { ruleSchema, type Rule, type RuleCheck } from "./types";

/** A row from `org_rule_overrides`, narrowed to the columns the merger needs. */
export type OverrideRow = {
  canonicalRuleId: string | null;
  jurisdiction: string;
  licenseCode: string;
  version: number;
  label: string;
  structuredPatch: RuleStructuredPatch;
  checksPatch: ChecksOverridePatch | ChecksCustomPatch;
  customMetadata: CustomRuleMetadata | null;
};

/**
 * Synthetic rule id format for custom org-authored rules. Canonical ids
 * never contain a colon, so this namespace can't collide. The format is
 * intentionally URL-safe so it slots into the existing assignment.ruleId
 * column without escaping.
 */
export function customRuleId(orgId: string, row: OverrideRow): string {
  return `org:${orgId}:custom:${row.jurisdiction}-${row.licenseCode}-v${row.version}`.toLowerCase();
}

/** True when an assignment.ruleId points at a custom rule (vs canonical). */
export function isCustomRuleId(ruleId: string): boolean {
  return ruleId.startsWith("org:") && ruleId.includes(":custom:");
}

/** Pull the orgId out of a custom rule id. Returns null on shape mismatch. */
export function orgIdFromCustomRuleId(ruleId: string): string | null {
  const m = /^org:([^:]+):custom:/.exec(ruleId);
  return m ? m[1] : null;
}

/** Parse a synthetic custom rule id back into its components. Returns null on
 *  shape mismatch. Mirrors customRuleId() above. */
export function parseCustomRuleId(ruleId: string): {
  orgId: string;
  jurisdiction: string;
  licenseCode: string;
  version: number;
} | null {
  const m = /^org:([^:]+):custom:([a-z]{2})-(.+)-v(\d+)$/i.exec(ruleId);
  if (!m) return null;
  return {
    orgId: m[1],
    jurisdiction: m[2].toUpperCase(),
    licenseCode: m[3].toUpperCase(),
    version: parseInt(m[4], 10),
  };
}

/**
 * Apply an org override on top of a canonical rule.
 *
 *   structured_patch fields replace the canonical structured field one-for-one.
 *   checks_patch.add appends new checks (custom_ prefix required).
 *   checks_patch.remove drops the named canonical checks.
 *   checks_patch.replace_params replaces the params object on the named check.
 *   checks_patch.replace_severity downgrades severity (validated above this layer).
 *
 * Returns a fully-formed Rule that the evaluator can consume. Throws if the
 * merged result fails canonical schema validation — that's a programmer
 * error, the action layer should have rejected the patch first.
 */
export function mergeOverride(canonical: Rule, patch: OverrideRow): Rule {
  const checksPatch = patch.checksPatch as ChecksOverridePatch;
  const removeSet = new Set(checksPatch.remove ?? []);
  const replaceParams = checksPatch.replace_params ?? {};
  const replaceSeverity = checksPatch.replace_severity ?? {};

  const merged: Rule = {
    ...canonical,
    structured: {
      ...canonical.structured,
      ...patch.structuredPatch,
    },
    checks: [
      ...canonical.checks
        .filter((c) => !removeSet.has(c.id))
        .map((c) => ({
          ...c,
          severity: replaceSeverity[c.id] ?? c.severity,
          params: replaceParams[c.id]
            ? { ...c.params, ...replaceParams[c.id] }
            : c.params,
        })),
      ...(checksPatch.add ?? []).map((c) => ({
        id: c.id,
        severity: c.severity,
        description: c.description,
        params: c.params ?? {},
      })),
    ],
  };

  // Validate the merged result — overrides should never be able to produce
  // an evaluator-incompatible Rule (e.g. negative total_practice_hours).
  // Action-layer Zod catches this earlier, but defense in depth.
  return ruleSchema.parse(merged);
}

/**
 * Build a Rule from a custom org-authored row. No canonical to inherit from
 * — everything comes from the row itself.
 */
export function buildCustomRule(orgId: string, row: OverrideRow): Rule {
  if (row.canonicalRuleId !== null) {
    throw new Error(
      "buildCustomRule called on an override row (canonicalRuleId is non-null)"
    );
  }
  if (!row.customMetadata) {
    throw new Error("Custom rule row is missing custom_metadata");
  }
  const checksPatch = row.checksPatch as ChecksCustomPatch;
  const checks: RuleCheck[] = (checksPatch.checks ?? []).map((c) => ({
    id: c.id,
    severity: c.severity,
    description: c.description,
    params: c.params ?? {},
  }));

  const merged: Rule = {
    jurisdiction: row.jurisdiction.toUpperCase(),
    license_code: row.licenseCode.toUpperCase(),
    license_name: row.customMetadata.license_name,
    issuing_board: row.customMetadata.issuing_board,
    version: row.version,
    summary: row.customMetadata.summary,
    effective_start: row.customMetadata.verification.last_verified_at,
    effective_end: null,
    citation: row.customMetadata.citation,
    verification: {
      ...row.customMetadata.verification,
      source_hash: `org:${orgId}:self-attested`,
    },
    structured: {
      total_practice_hours_required:
        row.structuredPatch.total_practice_hours_required ?? 1,
      total_supervision_hours_required:
        row.structuredPatch.total_supervision_hours_required ?? 1,
      ...(row.structuredPatch.min_duration_months !== undefined
        ? { min_duration_months: row.structuredPatch.min_duration_months }
        : {}),
      ...(row.structuredPatch.max_duration_months !== undefined
        ? { max_duration_months: row.structuredPatch.max_duration_months }
        : {}),
      ...(row.structuredPatch.group_max_attendees !== undefined
        ? { group_max_attendees: row.structuredPatch.group_max_attendees }
        : {}),
      ...(row.structuredPatch.min_individual_supervision_fraction !== undefined
        ? {
            min_individual_supervision_fraction:
              row.structuredPatch.min_individual_supervision_fraction,
          }
        : {}),
    },
    checks,
    evidence_requirements: {
      form_template_key: "default",
      required_signers: ["supervisor", "supervisee"],
      required_artifacts: [],
      optional_artifacts: [],
      immutability:
        "Once signed, the session record is sealed and the evidence package is generated.",
    },
    notes: [],
    page_content: undefined,
  };

  return ruleSchema.parse(merged);
}
