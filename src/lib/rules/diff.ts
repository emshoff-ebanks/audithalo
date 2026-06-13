/**
 * Override-vs-canonical diff summarizer for the rules-admin UI.
 *
 * Pure functions over Rule + OverrideRow. No DB, no FS. The dashboard
 * surfaces this in the "View diff" affordance on each active override
 * (Cycle 5) — gives the HR Admin one place to see "what did we change
 * from canonical" before deactivating.
 *
 * See docs/strategy/09-rules-admin.md §"Use cases" — the diff exists to
 * keep the contrast in the user's face so an inadvertent override is hard
 * to ignore.
 */

import type { ChecksOverridePatch, RuleStructuredPatch } from "@/lib/db/schema";
import type { Rule } from "./types";

export type StructuredDiffRow = {
  field: string;
  canonicalValue: number | undefined;
  overrideValue: number;
  direction: "tighter" | "looser" | "changed";
};

export type CheckDiffRow =
  | {
      kind: "severity_changed";
      checkId: string;
      canonicalSeverity: "info" | "warning" | "blocker";
      overrideSeverity: "info" | "warning" | "blocker";
    }
  | {
      kind: "removed";
      checkId: string;
      canonicalSeverity: "info" | "warning" | "blocker";
    };

export type OverrideDiffSummary = {
  structured: StructuredDiffRow[];
  checks: CheckDiffRow[];
  isNoOp: boolean;
};

const SEVERITY_RANK = { blocker: 3, warning: 2, info: 1 } as const;

const STRUCTURED_FIELD_LABELS: Record<string, string> = {
  total_practice_hours_required: "Total practice hours",
  total_supervision_hours_required: "Total supervision hours",
  min_duration_months: "Min duration (months)",
  max_duration_months: "Max duration (months)",
  group_max_attendees: "Group max attendees",
  min_individual_supervision_fraction: "Min individual supervision fraction",
};

/** Whether a structured-field override makes the rule stricter (tighter)
 *  or more permissive (looser) than canonical. Direction is computed per
 *  field because "higher = stricter" isn't universal (max_duration_months:
 *  higher = looser). Unknown fields default to "changed". */
function structuredDirection(
  field: string,
  canonicalValue: number | undefined,
  overrideValue: number
): "tighter" | "looser" | "changed" {
  if (canonicalValue === undefined) return "changed";
  if (canonicalValue === overrideValue) return "changed";

  // Fields where a higher number = stricter requirement.
  const higherIsTighter = new Set([
    "total_practice_hours_required",
    "total_supervision_hours_required",
    "min_duration_months",
    "min_individual_supervision_fraction",
  ]);
  // Fields where a lower number = stricter requirement.
  const lowerIsTighter = new Set([
    "max_duration_months",
    "group_max_attendees",
  ]);

  if (higherIsTighter.has(field)) {
    return overrideValue > canonicalValue ? "tighter" : "looser";
  }
  if (lowerIsTighter.has(field)) {
    return overrideValue < canonicalValue ? "tighter" : "looser";
  }
  return "changed";
}

/** Build a structured + checks diff summary for the View-diff UI.
 *  Skips structured fields whose patch value equals the canonical value
 *  (no-op overrides) and severity changes that don't actually change
 *  anything. */
export function summarizeOverrideDiff(
  canonical: Rule,
  override: {
    structuredPatch: RuleStructuredPatch;
    checksPatch: ChecksOverridePatch;
  }
): OverrideDiffSummary {
  const structured: StructuredDiffRow[] = [];
  for (const [k, v] of Object.entries(override.structuredPatch)) {
    if (typeof v !== "number") continue;
    const canonicalValue = (canonical.structured as Record<string, number>)[k];
    if (canonicalValue === v) continue;
    structured.push({
      field: STRUCTURED_FIELD_LABELS[k] ?? k,
      canonicalValue,
      overrideValue: v,
      direction: structuredDirection(k, canonicalValue, v),
    });
  }

  const checks: CheckDiffRow[] = [];
  const replaceSeverity = override.checksPatch.replace_severity ?? {};
  for (const [checkId, newSev] of Object.entries(replaceSeverity)) {
    const canonicalCheck = canonical.checks.find((c) => c.id === checkId);
    if (!canonicalCheck) continue;
    if (canonicalCheck.severity === newSev) continue;
    if (SEVERITY_RANK[newSev] > SEVERITY_RANK[canonicalCheck.severity]) continue;
    checks.push({
      kind: "severity_changed",
      checkId,
      canonicalSeverity: canonicalCheck.severity,
      overrideSeverity: newSev,
    });
  }
  for (const removedId of override.checksPatch.remove ?? []) {
    const canonicalCheck = canonical.checks.find((c) => c.id === removedId);
    if (!canonicalCheck) continue;
    checks.push({
      kind: "removed",
      checkId: removedId,
      canonicalSeverity: canonicalCheck.severity,
    });
  }

  return {
    structured,
    checks,
    isNoOp: structured.length === 0 && checks.length === 0,
  };
}
