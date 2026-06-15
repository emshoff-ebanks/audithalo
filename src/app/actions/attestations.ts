"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";

const attestSchema = z.object({
  assignmentId: z.string().uuid(),
  checkId: z.string().min(1),
  /** ISO 8601 date string (YYYY-MM-DD or full ISO). */
  date: z.string().min(8),
  /** Hours attested (only for valueShape "date_and_hours"). */
  hours: z.number().int().nonnegative().optional(),
  /** Permit issue date — only used by permit_expiration_window. */
  permitIssuedAt: z.string().min(8).optional(),
});

const undoSchema = z.object({
  assignmentId: z.string().uuid(),
  checkId: z.string().min(1),
});

export type AttestActionResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Record a supervisor's attestation for a check. Writes to the typed column
 * when the check has one (e.g. supervisionContractFiledAt); otherwise stores
 * in the jsonb `attestations` bag keyed by checkId.
 */
export async function attestAction(input: {
  assignmentId: string;
  checkId: string;
  value: { date: string; hours?: number; permitIssuedAt?: string };
}): Promise<AttestActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, reason: "Not authenticated." };

  const parsed = attestSchema.safeParse({
    assignmentId: input.assignmentId,
    checkId: input.checkId,
    date: input.value.date,
    hours: input.value.hours,
    permitIssuedAt: input.value.permitIssuedAt,
  });
  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.error.issues[0]?.message ?? "Invalid attestation input.",
    };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return { ok: false, reason: "No organization." };
  // Source of truth is the membership row, not the JWT-stamped users.role —
  // in Enterprise a user can hold different roles in different orgs, and
  // users.role lags membership changes until the next JWT mint.
  if (!canSupervise(membership.role)) {
    return { ok: false, reason: "Only supervisors can record attestations." };
  }

  const assignment = await db.query.superviseeRuleAssignments.findFirst({
    where: eq(schema.superviseeRuleAssignments.id, parsed.data.assignmentId),
  });
  if (!assignment) return { ok: false, reason: "Assignment not found." };
  if (assignment.orgId !== membership.orgId) {
    return { ok: false, reason: "Assignment belongs to another organization." };
  }

  const attestedAt = new Date();
  const attestedBy = session.user.id;
  const dateValue = new Date(parsed.data.date);

  let writtenTo: string;
  if (parsed.data.checkId === "pre_registration_required") {
    await db
      .update(schema.superviseeRuleAssignments)
      .set({ supervisionContractFiledAt: dateValue })
      .where(eq(schema.superviseeRuleAssignments.id, assignment.id));
    writtenTo = "supervisionContractFiledAt";
  } else if (parsed.data.checkId === "supervisor_training_course_required") {
    await db
      .update(schema.superviseeRuleAssignments)
      .set({
        supervisorTrainingCompletedAt: dateValue,
        supervisorTrainingHoursAttested: parsed.data.hours ?? null,
      })
      .where(eq(schema.superviseeRuleAssignments.id, assignment.id));
    writtenTo = "supervisorTrainingCompletedAt";
  } else if (parsed.data.checkId === "permit_expiration_window") {
    const issuedAt = parsed.data.permitIssuedAt
      ? new Date(parsed.data.permitIssuedAt)
      : null;
    await db
      .update(schema.superviseeRuleAssignments)
      .set({
        permitIssuedAt: issuedAt,
        permitExpiresAt: dateValue,
      })
      .where(eq(schema.superviseeRuleAssignments.id, assignment.id));
    writtenTo = "permitExpiresAt";
  } else {
    // Unknown check — write to the jsonb bag.
    const bag = (assignment.attestations ?? {}) as Record<
      string,
      { attestedAt: string; attestedBy: string; value: Record<string, unknown> }
    >;
    bag[parsed.data.checkId] = {
      attestedAt: attestedAt.toISOString(),
      attestedBy,
      value: {
        date: parsed.data.date,
        ...(parsed.data.hours !== undefined ? { hours: parsed.data.hours } : {}),
      },
    };
    await db
      .update(schema.superviseeRuleAssignments)
      .set({ attestations: bag })
      .where(eq(schema.superviseeRuleAssignments.id, assignment.id));
    writtenTo = "attestations.jsonb";
  }

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: attestedBy,
      action: AUDIT_ACTIONS.ATTESTATION_CREATED,
      resourceType: "supervisee_rule_assignment",
      resourceId: assignment.id,
      details: {
        checkId: parsed.data.checkId,
        writtenTo,
        value: {
          date: parsed.data.date,
          ...(parsed.data.hours !== undefined ? { hours: parsed.data.hours } : {}),
          ...(parsed.data.permitIssuedAt !== undefined
            ? { permitIssuedAt: parsed.data.permitIssuedAt }
            : {}),
        },
      },
    });
  } catch (err) {
    console.error("[audit-log] attestation.created failed:", err);
  }

  revalidatePath(`/dashboard/roster/${assignment.superviseeId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Revoke a previously recorded attestation. Nulls the typed column or removes
 * the jsonb bag entry, and writes an audit log row.
 */
export async function undoAttestationAction(input: {
  assignmentId: string;
  checkId: string;
}): Promise<AttestActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, reason: "Not authenticated." };

  const parsed = undoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "Invalid input." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return { ok: false, reason: "No organization." };
  if (!canSupervise(membership.role)) {
    return { ok: false, reason: "Only supervisors can revoke attestations." };
  }

  const assignment = await db.query.superviseeRuleAssignments.findFirst({
    where: eq(schema.superviseeRuleAssignments.id, parsed.data.assignmentId),
  });
  if (!assignment) return { ok: false, reason: "Assignment not found." };
  if (assignment.orgId !== membership.orgId) {
    return { ok: false, reason: "Assignment belongs to another organization." };
  }

  let revokedFrom: string;
  if (parsed.data.checkId === "pre_registration_required") {
    await db
      .update(schema.superviseeRuleAssignments)
      .set({ supervisionContractFiledAt: null })
      .where(eq(schema.superviseeRuleAssignments.id, assignment.id));
    revokedFrom = "supervisionContractFiledAt";
  } else if (parsed.data.checkId === "supervisor_training_course_required") {
    await db
      .update(schema.superviseeRuleAssignments)
      .set({
        supervisorTrainingCompletedAt: null,
        supervisorTrainingHoursAttested: null,
      })
      .where(eq(schema.superviseeRuleAssignments.id, assignment.id));
    revokedFrom = "supervisorTrainingCompletedAt";
  } else if (parsed.data.checkId === "permit_expiration_window") {
    await db
      .update(schema.superviseeRuleAssignments)
      .set({ permitIssuedAt: null, permitExpiresAt: null })
      .where(eq(schema.superviseeRuleAssignments.id, assignment.id));
    revokedFrom = "permitExpiresAt";
  } else {
    const bag = { ...(assignment.attestations ?? {}) } as Record<
      string,
      { attestedAt: string; attestedBy: string; value: Record<string, unknown> }
    >;
    if (bag[parsed.data.checkId]) {
      const { [parsed.data.checkId]: _removed, ...rest } = bag;
      void _removed;
      const finalBag = Object.keys(rest).length === 0 ? null : rest;
      await db
        .update(schema.superviseeRuleAssignments)
        .set({ attestations: finalBag })
        .where(eq(schema.superviseeRuleAssignments.id, assignment.id));
    }
    revokedFrom = "attestations.jsonb";
  }

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.ATTESTATION_REVOKED,
      resourceType: "supervisee_rule_assignment",
      resourceId: assignment.id,
      details: { checkId: parsed.data.checkId, revokedFrom },
    });
  } catch (err) {
    console.error("[audit-log] attestation.revoked failed:", err);
  }

  revalidatePath(`/dashboard/roster/${assignment.superviseeId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
