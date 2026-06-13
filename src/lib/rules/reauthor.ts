/**
 * Re-author prefill helpers (Cycle 6).
 *
 * When a canonical rule ships v2 and an org has an active v1 override, the
 * banner offers a "switch + re-author" path. The user is dropped onto the
 * v2 override editor with the v1 override's patches pre-loaded — these
 * helpers do the filtering so the editor is testable without the DB.
 *
 * Pure functions over Rule + a sliced override row. Drops patches whose
 * check ids no longer exist on the new canonical (the evaluator would
 * throw at run time); keeps the structured patch as-is (structured fields
 * are stable across versions in practice — when the board changes a
 * required-hours number, the v1 patch override is the explicit value the
 * org wants to preserve).
 */

import type { Rule } from "./types";
import type {
  ChecksOverridePatch,
  RuleStructuredPatch,
} from "@/lib/db/schema";

export type ReauthorSource = {
  canonicalRuleId: string | null;
  jurisdiction: string;
  licenseCode: string;
  label: string;
  structuredPatch: RuleStructuredPatch;
  checksPatch: ChecksOverridePatch;
};

export type ReauthorPrefill = {
  label: string;
  structuredPatch: RuleStructuredPatch;
  severityChanges: Record<string, "info" | "warning" | "blocker">;
  removeChecks: string[];
};

/** True when the source override's (jurisdiction, license) matches the
 *  destination canonical. Custom rules (canonicalRuleId === null) are
 *  not eligible — they aren't bound to a canonical version. */
export function isCompatibleReauthorSource(
  destinationCanonical: Rule,
  source: ReauthorSource
): boolean {
  if (source.canonicalRuleId === null) return false;
  return (
    source.jurisdiction.toUpperCase() ===
      destinationCanonical.jurisdiction.toUpperCase() &&
    source.licenseCode.toUpperCase() ===
      destinationCanonical.license_code.toUpperCase()
  );
}

/** Build the override-editor prefill from a sibling-version override row.
 *  Drops check-id patches whose ids don't exist on the destination
 *  canonical — the evaluator throws on unknown ids and there's no clean
 *  rename remap to do here. */
export function buildReauthorPrefill(
  destinationCanonical: Rule,
  source: ReauthorSource
): ReauthorPrefill {
  const canonicalCheckIds = new Set<string>(
    destinationCanonical.checks.map((c) => c.id)
  );

  const severityChanges: Record<string, "info" | "warning" | "blocker"> = {};
  for (const [k, v] of Object.entries(
    source.checksPatch.replace_severity ?? {}
  )) {
    if (canonicalCheckIds.has(k)) severityChanges[k] = v;
  }

  const removeChecks = (source.checksPatch.remove ?? []).filter((id) =>
    canonicalCheckIds.has(id)
  );

  return {
    label: source.label,
    structuredPatch: source.structuredPatch,
    severityChanges,
    removeChecks,
  };
}
