"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageOrg, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { getRule, parseRuleId } from "@/lib/rules/loader";
import {
  mergeOverride,
  type OverrideRow as OverrideRowShape,
} from "@/lib/rules/overrides";
import type {
  ChecksOverridePatch,
  RuleStructuredPatch,
} from "@/lib/db/schema";

const SEVERITY = z.enum(["info", "warning", "blocker"]);

const SEVERITY_RANK: Record<z.infer<typeof SEVERITY>, number> = {
  blocker: 3,
  warning: 2,
  info: 1,
};

const structuredPatchSchema = z
  .object({
    total_practice_hours_required: z.coerce.number().positive().optional(),
    total_supervision_hours_required: z.coerce.number().positive().optional(),
    min_duration_months: z.coerce.number().int().nonnegative().optional(),
    max_duration_months: z.coerce.number().int().positive().optional(),
    group_max_attendees: z.coerce.number().int().positive().optional(),
    min_individual_supervision_fraction: z.coerce
      .number()
      .min(0)
      .max(1)
      .optional(),
  })
  .strict();

const upsertSchema = z.object({
  canonicalRuleId: z.string().min(1),
  label: z.string().min(2).max(120),
  structuredPatch: structuredPatchSchema,
  /** Severity changes keyed by canonical check id. Validation enforces
   *  downgrade-only direction (blocker → warning → info; never the reverse). */
  severityChanges: z.record(z.string(), SEVERITY).default({}),
  /** Canonical check ids to drop. */
  removeChecks: z.array(z.string()).default([]),
  /** Optimistic-concurrency token. The form receives the row's updatedAt
   *  on render; the action rejects the save if it has drifted. */
  expectedUpdatedAt: z.string().nullable(),
});

export type UpsertOverrideResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; error: string; conflict: "stale_row" };

/**
 * Create or update an active override on a canonical rule.
 *
 * Authz: caller must be an HR Admin (canManageOrg) in the org.
 *
 * Concurrency: the form holds the row's updatedAt as a hidden field.
 * If the DB row has been updated since render (a co-admin edited it),
 * reject with conflict: "stale_row" so the UI can prompt a refresh.
 *
 * Validation: the merged Rule (canonical + this patch) must still pass
 * canonical Zod validation. Rejects e.g. total_supervision_hours = 0.
 *
 * Severity is downgrade-only — HR Admins can soften a blocker to a
 * warning but never the reverse. The remove list is honored as-is.
 */
export async function upsertCanonicalOverrideAction(
  input: z.infer<typeof upsertSchema>
): Promise<UpsertOverrideResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return { ok: false, error: "No organization." };
  if (!canManageOrg(membership.role)) {
    return { ok: false, error: "Only HR Admins can edit rule overrides." };
  }

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  // Resolve the canonical rule the override layers onto.
  const ruleParts = parseRuleId(parsed.data.canonicalRuleId);
  if (!ruleParts) {
    return { ok: false, error: "Unknown canonical rule id." };
  }
  let canonical;
  try {
    canonical = getRule(
      ruleParts.jurisdiction,
      ruleParts.licenseCode,
      ruleParts.version
    );
  } catch {
    return { ok: false, error: "Canonical rule no longer exists." };
  }

  // Severity downgrade-only enforcement.
  for (const [checkId, newSev] of Object.entries(parsed.data.severityChanges)) {
    const canonicalCheck = canonical.checks.find((c) => c.id === checkId);
    if (!canonicalCheck) {
      return {
        ok: false,
        error: `Check '${checkId}' isn't part of ${parsed.data.canonicalRuleId}.`,
      };
    }
    if (SEVERITY_RANK[newSev] > SEVERITY_RANK[canonicalCheck.severity]) {
      return {
        ok: false,
        error: `Severity can only be loosened, not strengthened. Check '${checkId}' is canonically ${canonicalCheck.severity}.`,
      };
    }
  }

  // Remove-checks must reference real canonical check ids.
  for (const checkId of parsed.data.removeChecks) {
    if (!canonical.checks.some((c) => c.id === checkId)) {
      return {
        ok: false,
        error: `Can't remove unknown check '${checkId}'.`,
      };
    }
  }

  // Build the merged Rule and let the override layer validate it against the
  // canonical Zod schema. Catches "total_supervision_hours_required = 0" etc.
  const checksPatch: ChecksOverridePatch = {
    ...(parsed.data.removeChecks.length > 0
      ? { remove: parsed.data.removeChecks }
      : {}),
    ...(Object.keys(parsed.data.severityChanges).length > 0
      ? { replace_severity: parsed.data.severityChanges }
      : {}),
  };
  const overrideRowShape: OverrideRowShape = {
    canonicalRuleId: parsed.data.canonicalRuleId,
    jurisdiction: canonical.jurisdiction,
    licenseCode: canonical.license_code,
    version: canonical.version,
    label: parsed.data.label,
    structuredPatch: parsed.data.structuredPatch as RuleStructuredPatch,
    checksPatch,
    customMetadata: null,
  };
  try {
    mergeOverride(canonical, overrideRowShape);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Merged rule failed validation: ${err.message}`
          : "Merged rule failed validation.",
    };
  }

  // Look up the existing active override (if any) for optimistic concurrency.
  const existing = await db.query.orgRuleOverrides.findFirst({
    where: and(
      eq(schema.orgRuleOverrides.orgId, membership.orgId),
      eq(schema.orgRuleOverrides.canonicalRuleId, parsed.data.canonicalRuleId),
      eq(schema.orgRuleOverrides.isActive, true)
    ),
  });

  if (existing) {
    if (
      parsed.data.expectedUpdatedAt &&
      existing.updatedAt.toISOString() !== parsed.data.expectedUpdatedAt
    ) {
      return {
        ok: false,
        error:
          "Someone else updated this override since you opened the editor. Refresh to see their changes before saving.",
        conflict: "stale_row",
      };
    }

    await db
      .update(schema.orgRuleOverrides)
      .set({
        label: parsed.data.label,
        structuredPatch: parsed.data.structuredPatch as RuleStructuredPatch,
        checksPatch,
        lastEditedBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.orgRuleOverrides.id, existing.id));

    try {
      await logAuditEvent({
        orgId: membership.orgId,
        actorUserId: session.user.id,
        action: AUDIT_ACTIONS.ORG_RULE_OVERRIDE_UPSERTED,
        resourceType: "org_rule_override",
        resourceId: existing.id,
        details: {
          canonicalRuleId: parsed.data.canonicalRuleId,
          mode: "update",
          structuredPatchKeys: Object.keys(parsed.data.structuredPatch),
          severityChangeCount: Object.keys(parsed.data.severityChanges).length,
          removeCount: parsed.data.removeChecks.length,
        },
      });
    } catch (err) {
      console.error("[audit-log] org_rule_override.upserted failed:", err);
    }
  } else {
    const [inserted] = await db
      .insert(schema.orgRuleOverrides)
      .values({
        orgId: membership.orgId,
        canonicalRuleId: parsed.data.canonicalRuleId,
        jurisdiction: canonical.jurisdiction,
        licenseCode: canonical.license_code,
        version: canonical.version,
        label: parsed.data.label,
        structuredPatch: parsed.data.structuredPatch as RuleStructuredPatch,
        checksPatch,
        createdBy: session.user.id,
        lastEditedBy: session.user.id,
      })
      .returning({ id: schema.orgRuleOverrides.id });

    try {
      await logAuditEvent({
        orgId: membership.orgId,
        actorUserId: session.user.id,
        action: AUDIT_ACTIONS.ORG_RULE_OVERRIDE_UPSERTED,
        resourceType: "org_rule_override",
        resourceId: inserted.id,
        details: {
          canonicalRuleId: parsed.data.canonicalRuleId,
          mode: "create",
          structuredPatchKeys: Object.keys(parsed.data.structuredPatch),
          severityChangeCount: Object.keys(parsed.data.severityChanges).length,
          removeCount: parsed.data.removeChecks.length,
        },
      });
    } catch (err) {
      console.error("[audit-log] org_rule_override.upserted failed:", err);
    }
  }

  revalidatePath("/dashboard/team/rules");
  revalidatePath(`/dashboard/team/rules/${parsed.data.canonicalRuleId}`);
  return { ok: true };
}
