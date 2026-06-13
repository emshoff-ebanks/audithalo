/**
 * Org-aware rule resolver. Layered on top of evaluation-context.ts so
 * non-DB consumers (cron paths, marketing site, tests) don't transitively
 * import the Drizzle client.
 *
 * Read this together with docs/strategy/09-rules-admin.md.
 */

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { evaluate } from "./evaluator";
import {
  buildEvaluationContext,
  type ResolvedEvaluation,
} from "./evaluation-context";
import { getRule } from "./loader";
import {
  buildCustomRule,
  isCustomRuleId,
  mergeOverride,
  parseCustomRuleId,
  type OverrideRow,
} from "./overrides";
import type { Rule } from "./types";

type Assignment = typeof schema.superviseeRuleAssignments.$inferSelect;
type SessionEvent = typeof schema.sessionEvents.$inferSelect;

/**
 * Org-aware variant of resolveEvaluation. Layers any active org override
 * on top of the canonical rule (or loads the custom rule entirely from
 * the DB when the assignment points at one). Falls back to canonical-only
 * behavior when no override row exists.
 *
 * Async because override + custom rule rows live in Postgres. Use this
 * inside server components / route handlers; the sync resolveEvaluation
 * stays for cron paths and marketing pages that never want org tailoring.
 */
export async function resolveEvaluationWithOverrides(
  assignment: Assignment,
  events: SessionEvent[],
  asOf: Date = new Date()
): Promise<ResolvedEvaluation | null> {
  let rule: Rule | null = null;

  if (isCustomRuleId(assignment.ruleId)) {
    // Custom rule: the entire definition lives in org_rule_overrides. An
    // org can have multiple active custom rules (one per jur/license/version
    // tuple), so look up the row keyed by all four columns rather than just
    // orgId — otherwise we'd return the first active row regardless of which
    // custom rule the assignment actually points at.
    const parts = parseCustomRuleId(assignment.ruleId);
    if (!parts || parts.orgId !== assignment.orgId) return null;

    const row = await db.query.orgRuleOverrides.findFirst({
      where: and(
        eq(schema.orgRuleOverrides.orgId, assignment.orgId),
        eq(schema.orgRuleOverrides.jurisdiction, parts.jurisdiction),
        eq(schema.orgRuleOverrides.licenseCode, parts.licenseCode),
        eq(schema.orgRuleOverrides.version, parts.version),
        eq(schema.orgRuleOverrides.isActive, true)
      ),
    });
    if (!row || row.canonicalRuleId !== null) return null;
    try {
      rule = buildCustomRule(assignment.orgId, toOverrideRow(row));
    } catch {
      return null;
    }
  } else {
    // Canonical rule: load YAML, then merge any active override.
    const [, jur, lic, vRaw] =
      assignment.ruleId.match(/^(.+?)-(.+?)-v(\d+)$/) ?? [];
    if (!jur || !lic || !vRaw) return null;

    try {
      rule = getRule(jur.toUpperCase(), lic.toUpperCase(), parseInt(vRaw, 10));
    } catch {
      return null;
    }

    const overrideRow = await db.query.orgRuleOverrides.findFirst({
      where: and(
        eq(schema.orgRuleOverrides.orgId, assignment.orgId),
        eq(schema.orgRuleOverrides.canonicalRuleId, assignment.ruleId),
        eq(schema.orgRuleOverrides.isActive, true)
      ),
    });
    if (overrideRow) {
      try {
        rule = mergeOverride(rule, toOverrideRow(overrideRow));
      } catch {
        // Bad override (failed schema validation) — fall back to canonical
        // so the supervisee dashboard still works while the HR Admin fixes
        // their patch. The action layer normally catches this earlier.
      }
    }
  }

  if (!rule) return null;

  const ctx = buildEvaluationContext(assignment, events, asOf);
  return { rule, evaluation: evaluate(ctx, rule) };
}

/** Narrow the Drizzle row into the OverrideRow shape merge helpers consume. */
function toOverrideRow(
  row: typeof schema.orgRuleOverrides.$inferSelect
): OverrideRow {
  return {
    canonicalRuleId: row.canonicalRuleId,
    jurisdiction: row.jurisdiction,
    licenseCode: row.licenseCode,
    version: row.version,
    label: row.label,
    structuredPatch: row.structuredPatch,
    checksPatch: row.checksPatch,
    customMetadata: row.customMetadata,
  };
}
