import type { LeaveStatus } from "@/lib/db/schema";
import type { PaycorEmployee, PaycorChange, ApplyContext, OrgRole } from "./types";
import { mapPaycorStatus } from "./types";

export type CurrentMember = {
  membershipId: string;
  userId: string;
  email: string;
  role: OrgRole;
  deactivatedAt: Date | null;
  leaveStatus: LeaveStatus;
};

export type DiffEntry = {
  change: PaycorChange;
  context: ApplyContext;
};

/**
 * Pure function: compare the Paycor roster to the current AuditHalo roster
 * and produce a list of changes to apply.
 *
 * Matching is by email (lowercased). This avoids needing a stored
 * paycorEmployeeId column — deferred to migration 0031.
 *
 * Does NOT produce changes for AuditHalo members missing from Paycor.
 * A missing employee could be in a different legal entity or the API
 * returned a partial page. We only act on employees Paycor reports.
 */
export function diffRoster(
  paycorEmployees: PaycorEmployee[],
  currentMembers: CurrentMember[],
  orgId: string,
): DiffEntry[] {
  const changes: DiffEntry[] = [];

  const membersByEmail = new Map<string, CurrentMember>();
  for (const m of currentMembers) {
    membersByEmail.set(m.email.toLowerCase(), m);
  }

  for (const emp of paycorEmployees) {
    const email = emp.email.toLowerCase();
    const existing = membersByEmail.get(email);
    const status = mapPaycorStatus(emp.status);

    if (!existing) {
      if (status.disposition === "terminated") continue;

      changes.push({
        change: {
          kind: "employee_hired",
          employee: emp,
          role: "supervisee",
        },
        context: { orgId },
      });
      continue;
    }

    if (existing.deactivatedAt) {
      if (status.disposition !== "terminated") {
        changes.push({
          change: {
            kind: "employee_hired",
            employee: emp,
            role: existing.role,
          },
          context: {
            orgId,
            membershipId: existing.membershipId,
            userId: existing.userId,
          },
        });
      }
      continue;
    }

    if (status.disposition === "terminated") {
      changes.push({
        change: {
          kind: "employee_terminated",
          employeeId: emp.paycorEmployeeId,
          terminatedAt: emp.terminationDate ?? new Date(),
        },
        context: {
          orgId,
          membershipId: existing.membershipId,
          userId: existing.userId,
        },
      });
      continue;
    }

    if (
      status.disposition === "active" ||
      status.disposition === "on_leave"
    ) {
      const newLeaveStatus = status.leaveStatus;
      if (newLeaveStatus !== existing.leaveStatus) {
        changes.push({
          change: {
            kind: "leave_status_changed",
            employeeId: emp.paycorEmployeeId,
            status: newLeaveStatus,
            effectiveAt: new Date(),
          },
          context: {
            orgId,
            membershipId: existing.membershipId,
            userId: existing.userId,
          },
        });
      }
    }
  }

  return changes;
}
