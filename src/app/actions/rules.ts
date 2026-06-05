"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { loadAllRules, parseRuleId } from "@/lib/rules";

export type RuleActionResult =
  | { ok: true }
  | { ok: false; error: string };

const applySchema = z.object({
  assignmentId: z.string().uuid(),
  newRuleId: z.string().min(1),
});

/**
 * Move a supervisee's assignment to a new rule version. Used both by the
 * "Apply v2" banner on the supervisee detail page and by the daily cron when
 * the supervisor has auto_apply_rule_updates enabled.
 *
 * Validates:
 *   - caller is a supervisor in the assignment's org
 *   - newRuleId resolves to a known rule
 *   - newRuleId's (jurisdiction, license) matches the current ruleId's pair
 *     (you can't accidentally swap a supervisee to a different state's rule)
 *   - newRuleId's version is greater than the current — we don't allow
 *     downgrading via this action
 *
 * Clears any rule_change_snoozed_at when the apply succeeds.
 */
export async function applyRuleVersionAction(
  input: { assignmentId: string; newRuleId: string }
): Promise<RuleActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };
  if (!canSupervise(session.user.role)) {
    return { ok: false, error: "Only supervisors can apply rule updates." };
  }

  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return { ok: false, error: "No organization." };

  const assignment = await db.query.superviseeRuleAssignments.findFirst({
    where: eq(schema.superviseeRuleAssignments.id, parsed.data.assignmentId),
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };
  if (assignment.orgId !== membership.orgId) {
    return { ok: false, error: "Assignment belongs to another organization." };
  }

  const current = parseRuleId(assignment.ruleId);
  const next = parseRuleId(parsed.data.newRuleId);
  if (!current || !next) {
    return { ok: false, error: "Unrecognized rule identifier." };
  }
  if (
    current.jurisdiction !== next.jurisdiction ||
    current.licenseCode !== next.licenseCode
  ) {
    return {
      ok: false,
      error:
        "Cross-state rule swaps aren't supported through this action — re-assign manually instead.",
    };
  }
  if (next.version <= current.version) {
    return {
      ok: false,
      error: "Refusing to downgrade — version must be greater than current.",
    };
  }
  if (!loadAllRules().has(parsed.data.newRuleId.toLowerCase())) {
    return { ok: false, error: "Target rule version isn't loaded." };
  }

  await db
    .update(schema.superviseeRuleAssignments)
    .set({
      ruleId: parsed.data.newRuleId,
      // The apply resolves whatever the snooze was for — clear it so a
      // future v3 prompt is allowed through.
      ruleChangeSnoozedAt: null,
    })
    .where(eq(schema.superviseeRuleAssignments.id, assignment.id));

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.RULE_CHANGED,
      resourceType: "supervisee_rule_assignment",
      resourceId: assignment.id,
      details: {
        priorRuleId: assignment.ruleId,
        newRuleId: parsed.data.newRuleId,
        trigger: "manual_apply",
      },
    });
  } catch (err) {
    console.error("[audit-log] rule.changed (apply) failed:", err);
  }

  revalidatePath(`/dashboard/roster/${assignment.superviseeId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

const dismissSchema = z.object({
  assignmentId: z.string().uuid(),
});

/**
 * Snooze the rule-update prompt for one assignment. The daily cron skips
 * rule_changed notifications for 30 days afterward.
 *
 * Useful when a supervisor needs the supervisee to finish their current
 * obligation under v1 even though v2 is live.
 */
export async function dismissRuleChangeAction(
  input: { assignmentId: string }
): Promise<RuleActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };
  if (!canSupervise(session.user.role)) {
    return { ok: false, error: "Only supervisors can dismiss rule updates." };
  }

  const parsed = dismissSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return { ok: false, error: "No organization." };

  const assignment = await db.query.superviseeRuleAssignments.findFirst({
    where: eq(schema.superviseeRuleAssignments.id, parsed.data.assignmentId),
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };
  if (assignment.orgId !== membership.orgId) {
    return { ok: false, error: "Assignment belongs to another organization." };
  }

  await db
    .update(schema.superviseeRuleAssignments)
    .set({ ruleChangeSnoozedAt: new Date() })
    .where(eq(schema.superviseeRuleAssignments.id, assignment.id));

  revalidatePath(`/dashboard/roster/${assignment.superviseeId}`);
  return { ok: true };
}

const togglePrefSchema = z.object({
  enabled: z.boolean(),
});

/**
 * Toggle the per-supervisor auto-apply preference. When enabled, the daily
 * cron auto-bumps any of this supervisor's assignments whose ruleId is older
 * than the latest available, and still emits a rule_changed notification as
 * a heads-up.
 */
export async function updateAutoApplyRuleUpdatesAction(
  input: { enabled: boolean }
): Promise<RuleActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = togglePrefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await db
    .update(schema.users)
    .set({ autoApplyRuleUpdates: parsed.data.enabled })
    .where(eq(schema.users.id, session.user.id));

  revalidatePath("/dashboard/account");
  return { ok: true };
}
