import { eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { seatCap, countBillableSeats } from "@/lib/billing/seats";
import type { PaycorChange, ApplyContext, ApplyResult } from "./types";
import { SeatCapExceededError, mapPaycorStatus } from "./types";

export async function applyPaycorChange(
  change: PaycorChange,
  ctx: ApplyContext,
): Promise<ApplyResult> {
  switch (change.kind) {
    case "employee_hired":
      return applyHired(change, ctx);
    case "employee_terminated":
      return applyTerminated(change, ctx);
    case "leave_status_changed":
      return applyLeaveStatusChanged(change, ctx);
    case "role_changed":
      return applyRoleChanged(change, ctx);
  }
}

// ---------------------------------------------------------------------------
// employee_hired
// ---------------------------------------------------------------------------

async function applyHired(
  change: Extract<PaycorChange, { kind: "employee_hired" }>,
  ctx: ApplyContext,
): Promise<ApplyResult> {
  const { employee, role } = change;
  const email = employee.email.toLowerCase().trim();
  const statusMapping = mapPaycorStatus(employee.status);
  const initialLeaveStatus =
    statusMapping.disposition === "on_leave" ? "on_leave" : "active";

  if (role === "supervisee") {
    const org = await db.query.organizations.findFirst({
      where: eq(schema.organizations.id, ctx.orgId),
    });
    if (org) {
      const cap = seatCap(org);
      if (cap !== null) {
        const used = await countBillableSeats(ctx.orgId);
        if (used >= cap) {
          throw new SeatCapExceededError(ctx.orgId, email, cap, used);
        }
      }
    }
  }

  let user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  let userId: string;
  if (user) {
    userId = user.id;
  } else {
    const [created] = await db
      .insert(schema.users)
      .values({
        email,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        role,
      })
      .returning({ id: schema.users.id });
    userId = created.id;
  }

  const existing = await db.query.orgMemberships.findFirst({
    where: and(
      eq(schema.orgMemberships.orgId, ctx.orgId),
      eq(schema.orgMemberships.userId, userId),
    ),
  });

  if (existing) {
    if (existing.deactivatedAt) {
      await db
        .update(schema.orgMemberships)
        .set({
          deactivatedAt: null,
          deactivatedByUserId: null,
          leaveStatus: initialLeaveStatus,
          leaveStatusChangedAt: new Date(),
          leaveStatusSource: "paycor_sync",
        })
        .where(eq(schema.orgMemberships.id, existing.id));

      try {
        await logAuditEvent({
          orgId: ctx.orgId,
          actorUserId: null,
          action: AUDIT_ACTIONS.PAYCOR_SYNC_EMPLOYEE_HIRED,
          resourceType: "user",
          resourceId: userId,
          details: {
            paycorEmployeeId: employee.paycorEmployeeId,
            reactivated: true,
          },
        });
      } catch {
        /* audit failures must not break the sync */
      }

      return {
        action: "updated",
        userId,
        membershipId: existing.id,
        details: { reactivated: true },
      };
    }
    return { action: "skipped", userId, membershipId: existing.id };
  }

  const [membership] = await db
    .insert(schema.orgMemberships)
    .values({
      orgId: ctx.orgId,
      userId,
      role,
      leaveStatus: initialLeaveStatus,
      leaveStatusSource: "paycor_sync",
    })
    .returning({ id: schema.orgMemberships.id });

  try {
    await logAuditEvent({
      orgId: ctx.orgId,
      actorUserId: null,
      action: AUDIT_ACTIONS.PAYCOR_SYNC_EMPLOYEE_HIRED,
      resourceType: "user",
      resourceId: userId,
      details: {
        paycorEmployeeId: employee.paycorEmployeeId,
        email,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        role,
      },
    });
  } catch {
    /* audit failures must not break the sync */
  }

  return { action: "created", userId, membershipId: membership.id };
}

// ---------------------------------------------------------------------------
// employee_terminated
// ---------------------------------------------------------------------------

async function applyTerminated(
  change: Extract<PaycorChange, { kind: "employee_terminated" }>,
  ctx: ApplyContext,
): Promise<ApplyResult> {
  if (!ctx.membershipId) {
    return { action: "skipped", details: { reason: "no_membership_id" } };
  }

  const membership = await db.query.orgMemberships.findFirst({
    where: eq(schema.orgMemberships.id, ctx.membershipId),
  });
  if (!membership || membership.deactivatedAt) {
    return {
      action: "skipped",
      userId: ctx.userId,
      membershipId: ctx.membershipId,
    };
  }

  await db
    .update(schema.orgMemberships)
    .set({ deactivatedAt: change.terminatedAt })
    .where(eq(schema.orgMemberships.id, ctx.membershipId));

  try {
    await logAuditEvent({
      orgId: ctx.orgId,
      actorUserId: null,
      action: AUDIT_ACTIONS.PAYCOR_SYNC_EMPLOYEE_TERMINATED,
      resourceType: "user",
      resourceId: ctx.userId ?? undefined,
      details: {
        paycorEmployeeId: change.employeeId,
        terminatedAt: change.terminatedAt.toISOString(),
      },
    });
  } catch {
    /* audit failures must not break the sync */
  }

  return {
    action: "deactivated",
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  };
}

// ---------------------------------------------------------------------------
// leave_status_changed
// ---------------------------------------------------------------------------

async function applyLeaveStatusChanged(
  change: Extract<PaycorChange, { kind: "leave_status_changed" }>,
  ctx: ApplyContext,
): Promise<ApplyResult> {
  if (!ctx.membershipId) {
    return { action: "skipped", details: { reason: "no_membership_id" } };
  }

  const membership = await db.query.orgMemberships.findFirst({
    where: eq(schema.orgMemberships.id, ctx.membershipId),
  });
  if (!membership || membership.leaveStatus === change.status) {
    return {
      action: "skipped",
      userId: ctx.userId,
      membershipId: ctx.membershipId,
    };
  }

  await db
    .update(schema.orgMemberships)
    .set({
      leaveStatus: change.status,
      leaveStatusChangedAt: change.effectiveAt,
      leaveStatusSource: "paycor_sync",
    })
    .where(eq(schema.orgMemberships.id, ctx.membershipId));

  try {
    await logAuditEvent({
      orgId: ctx.orgId,
      actorUserId: null,
      action: AUDIT_ACTIONS.PAYCOR_SYNC_LEAVE_CHANGED,
      resourceType: "org_membership",
      resourceId: ctx.membershipId,
      details: {
        paycorEmployeeId: change.employeeId,
        previousStatus: membership.leaveStatus,
        newStatus: change.status,
        effectiveAt: change.effectiveAt.toISOString(),
      },
    });
  } catch {
    /* audit failures must not break the sync */
  }

  return {
    action: "updated",
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  };
}

// ---------------------------------------------------------------------------
// role_changed
// ---------------------------------------------------------------------------

async function applyRoleChanged(
  change: Extract<PaycorChange, { kind: "role_changed" }>,
  ctx: ApplyContext,
): Promise<ApplyResult> {
  if (!ctx.membershipId || !ctx.userId) {
    return {
      action: "skipped",
      details: { reason: "no_membership_or_user_id" },
    };
  }

  const membership = await db.query.orgMemberships.findFirst({
    where: eq(schema.orgMemberships.id, ctx.membershipId),
  });
  if (!membership || membership.role === change.auditHaloRole) {
    return {
      action: "skipped",
      userId: ctx.userId,
      membershipId: ctx.membershipId,
    };
  }

  await db
    .update(schema.orgMemberships)
    .set({ role: change.auditHaloRole })
    .where(eq(schema.orgMemberships.id, ctx.membershipId));

  await db
    .update(schema.users)
    .set({ role: change.auditHaloRole })
    .where(eq(schema.users.id, ctx.userId));

  try {
    await logAuditEvent({
      orgId: ctx.orgId,
      actorUserId: null,
      action: AUDIT_ACTIONS.PAYCOR_SYNC_ROLE_CHANGED,
      resourceType: "org_membership",
      resourceId: ctx.membershipId,
      details: {
        paycorEmployeeId: change.employeeId,
        previousRole: membership.role,
        newRole: change.auditHaloRole,
      },
    });
  } catch {
    /* audit failures must not break the sync */
  }

  return {
    action: "updated",
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  };
}
