"use server";

import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageOrg, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { getLatestRuleByJurLic } from "@/lib/rules/loader";
import {
  buildCustomRule,
  customRuleId,
  type OverrideRow as OverrideRowShape,
} from "@/lib/rules/overrides";
import { notifyOverrideCoAdmins } from "@/lib/rules/co-admin-notify";
import {
  buildRuleCheckFromInstance,
  TEMPLATE_CATALOG,
  validateInstance,
  type CheckTemplateInstance,
  type CheckTemplateKey,
} from "@/lib/rules/check-templates";
import type {
  ChecksCustomPatch,
  CustomRuleMetadata,
} from "@/lib/db/schema";

const SEVERITY = z.enum(["info", "warning", "blocker"]);

const TEMPLATE_KEYS = [
  "total_hours",
  "supervision_ratio",
  "cadence",
  "group_cap",
  "attestation",
  "time_window",
  "permit_window",
] as const satisfies readonly CheckTemplateKey[];

const checkInstanceSchema = z.object({
  templateKey: z.enum(TEMPLATE_KEYS),
  subKind: z.string().min(1),
  severity: SEVERITY,
  description: z.string().max(500).default(""),
  params: z.record(z.string(), z.coerce.number()),
});

const structuredSchema = z
  .object({
    total_practice_hours_required: z.coerce.number().positive(),
    total_supervision_hours_required: z.coerce.number().positive(),
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

const createCustomRuleSchema = z.object({
  jurisdiction: z
    .string()
    .length(2)
    .transform((v) => v.toUpperCase()),
  licenseCode: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "License code may only contain letters, numbers, dashes, and underscores.")
    .transform((v) => v.toUpperCase()),
  label: z.string().min(2).max(120),
  licenseName: z.string().min(2).max(160),
  issuingBoard: z.string().min(2).max(160),
  summary: z.string().min(10).max(2000),
  citationAdmincode: z.string().min(2).max(200),
  citationStatute: z.string().max(200).optional(),
  citationUrl: z.string().url(),
  structured: structuredSchema,
  checks: z.array(checkInstanceSchema).min(1),
});

export type CreateCustomRuleResult =
  | { ok: true; ruleId: string }
  | { ok: false; error: string };

/**
 * Create a custom org-authored rule. Distinct from rule overrides — there
 * is no canonical to layer on top of, the org supplies the entire
 * definition. Used when AuditHalo hasn't shipped a canonical YAML for the
 * supervisee's state yet.
 *
 * Authz: caller must be an HR Admin.
 *
 * Hard guards:
 *   - jurisdiction + license tuple must NOT already have a canonical rule
 *     (those should be overridden via cycle 3, not duplicated as customs).
 *   - the seven-template catalog is the only allowed check authoring path;
 *     the action validates each instance through validateInstance.
 *   - the final merged Rule must pass canonical Zod validation via
 *     buildCustomRule — catches zero-hour limits etc.
 *   - citation URL must be a real URL; the wizard requires a board source
 *     because a self-attested rule without a citation is the most
 *     dangerous failure mode.
 */
export async function createCustomRuleAction(
  input: z.infer<typeof createCustomRuleSchema>
): Promise<CreateCustomRuleResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return { ok: false, error: "No organization." };
  if (!canManageOrg(membership.role)) {
    return { ok: false, error: "Only HR Admins can create custom rules." };
  }

  const parsed = createCustomRuleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  // Guard: if a canonical rule already exists for this (jurisdiction, license)
  // pair, the HR Admin should override it via cycle 3 instead of duplicating
  // it as a custom. Mismatched custom + canonical for the same state would
  // confuse the assignment surface.
  const existingCanonical = getLatestRuleByJurLic(
    parsed.data.jurisdiction,
    parsed.data.licenseCode
  );
  if (existingCanonical) {
    return {
      ok: false,
      error: `A canonical rule already exists for ${parsed.data.jurisdiction} ${parsed.data.licenseCode}. Customize it from the rules dashboard instead of creating a new custom rule.`,
    };
  }

  // Validate every template instance against the catalog before persisting.
  const instances: CheckTemplateInstance[] = [];
  const seenEvaluatorIds = new Set<string>();
  for (const c of parsed.data.checks) {
    const template = TEMPLATE_CATALOG[c.templateKey as CheckTemplateKey];
    if (!template) {
      return { ok: false, error: `Unknown template '${c.templateKey}'.` };
    }
    const subKind = template.subKinds[c.subKind];
    if (!subKind) {
      return {
        ok: false,
        error: `Unknown sub-kind '${c.subKind}' for template '${c.templateKey}'.`,
      };
    }
    const instance: CheckTemplateInstance = {
      templateKey: c.templateKey as CheckTemplateKey,
      subKind: c.subKind,
      severity: c.severity,
      description: c.description,
      params: c.params,
    };
    try {
      validateInstance(instance);
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error ? err.message : "Invalid check parameters.",
      };
    }
    if (seenEvaluatorIds.has(subKind.evaluatorId)) {
      return {
        ok: false,
        error: `Duplicate check '${subKind.evaluatorId}'. Each template + sub-kind may only appear once per rule.`,
      };
    }
    seenEvaluatorIds.add(subKind.evaluatorId);
    instances.push(instance);
  }

  // Determine the next version for (org, jurisdiction, license_code) among
  // custom rules (canonical_rule_id IS NULL). The partial unique index on
  // (org_id, jur, license, version) WHERE is_active AND canonical NULL would
  // block re-creating an already-active tuple, so we bump above any prior
  // version this org has used for this state.
  const priorVersions = await db
    .select({ version: schema.orgRuleOverrides.version })
    .from(schema.orgRuleOverrides)
    .where(
      and(
        eq(schema.orgRuleOverrides.orgId, membership.orgId),
        eq(schema.orgRuleOverrides.jurisdiction, parsed.data.jurisdiction),
        eq(schema.orgRuleOverrides.licenseCode, parsed.data.licenseCode),
        isNull(schema.orgRuleOverrides.canonicalRuleId)
      )
    );
  const version =
    priorVersions.reduce((max, r) => Math.max(max, r.version), 0) + 1;

  // Compose the in-memory rule + persist it. buildCustomRule round-trips
  // the structured + checks through Zod so the action fails closed on
  // invalid combinations (e.g., zero hours).
  const checks = instances.map(buildRuleCheckFromInstance);
  const checksPatch: ChecksCustomPatch = {
    checks: checks.map((c) => ({
      id: c.id,
      severity: c.severity,
      description: c.description,
      params: c.params,
    })),
  };
  const customMetadata: CustomRuleMetadata = {
    license_name: parsed.data.licenseName,
    issuing_board: parsed.data.issuingBoard,
    summary: parsed.data.summary,
    citation: {
      admincode: parsed.data.citationAdmincode,
      ...(parsed.data.citationStatute
        ? { statute: parsed.data.citationStatute }
        : {}),
      url: parsed.data.citationUrl,
    },
    verification: {
      last_verified_at: new Date().toISOString(),
      last_verified_by: session.user.email ?? session.user.id,
    },
  };

  const rowShape: OverrideRowShape = {
    canonicalRuleId: null,
    jurisdiction: parsed.data.jurisdiction,
    licenseCode: parsed.data.licenseCode,
    version,
    label: parsed.data.label,
    structuredPatch: parsed.data.structured,
    checksPatch,
    customMetadata,
  };
  try {
    buildCustomRule(membership.orgId, rowShape);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Custom rule failed validation: ${err.message}`
          : "Custom rule failed validation.",
    };
  }

  const [inserted] = await db
    .insert(schema.orgRuleOverrides)
    .values({
      orgId: membership.orgId,
      canonicalRuleId: null,
      jurisdiction: parsed.data.jurisdiction,
      licenseCode: parsed.data.licenseCode,
      version,
      label: parsed.data.label,
      structuredPatch: parsed.data.structured,
      checksPatch,
      customMetadata,
      createdBy: session.user.id,
      lastEditedBy: session.user.id,
    })
    .returning({ id: schema.orgRuleOverrides.id });

  const ruleId = customRuleId(membership.orgId, rowShape);

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.ORG_CUSTOM_RULE_CREATED,
      resourceType: "org_rule_override",
      resourceId: inserted.id,
      details: {
        ruleId,
        jurisdiction: parsed.data.jurisdiction,
        licenseCode: parsed.data.licenseCode,
        version,
        checkCount: checks.length,
      },
    });
  } catch (err) {
    console.error("[audit-log] org_custom_rule.created failed:", err);
  }

  // Cycle 7: notify co-admins of the new custom rule.
  await notifyOverrideCoAdmins({
    orgId: membership.orgId,
    actorUserId: session.user.id,
    action: "created",
    ruleLabel: `${parsed.data.jurisdiction} ${parsed.data.licenseCode} v${version} (org-created)`,
  });

  revalidatePath("/dashboard/team/rules");
  return { ok: true, ruleId };
}
