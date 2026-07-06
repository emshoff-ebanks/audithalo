import type { LeaveStatus } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Paycor employment status — 13 values from swagger v1
// GET /v1/legalentities/{legalEntityId}/employees → statusData.status
// ---------------------------------------------------------------------------

export const PAYCOR_EMPLOYMENT_STATUSES = [
  "Active",
  "Deceased",
  "LongTermDisability",
  "ShortTermDisability",
  "Fmla",
  "LaidOff",
  "LeaveWithPay",
  "LeaveWithoutPay",
  "ThirdPartyPayable",
  "Resigned",
  "Retired",
  "Terminated",
  "WorkersCompensation",
] as const;

export type PaycorEmploymentStatus =
  (typeof PAYCOR_EMPLOYMENT_STATUSES)[number];

// ---------------------------------------------------------------------------
// AuditHalo role (mirrors the userRole pgEnum)
// ---------------------------------------------------------------------------

export type OrgRole = "supervisee" | "supervisor" | "hr_admin" | "executive";

// ---------------------------------------------------------------------------
// PaycorEmployee — normalized flat shape from the Paycor API response.
// The swagger nests fields (email.emailAddress, statusData.status,
// positionData.jobTitle, etc.) — the provider flattens on fetch.
// ---------------------------------------------------------------------------

export type PaycorEmployee = {
  paycorEmployeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: PaycorEmploymentStatus;
  jobTitle: string | null;
  managerId: string | null;
  hireDate: Date | null;
  terminationDate: Date | null;
};

// ---------------------------------------------------------------------------
// PaycorChange — the 4 change kinds produced by diffRoster (Pass 2).
// Each change is applied atomically by applyPaycorChange().
// ---------------------------------------------------------------------------

export type PaycorChange =
  | { kind: "employee_hired"; employee: PaycorEmployee; role: OrgRole }
  | { kind: "employee_terminated"; employeeId: string; terminatedAt: Date }
  | {
      kind: "leave_status_changed";
      employeeId: string;
      status: LeaveStatus;
      effectiveAt: Date;
    }
  | { kind: "role_changed"; employeeId: string; auditHaloRole: OrgRole };

// ---------------------------------------------------------------------------
// ApplyContext — caller-resolved DB identifiers for the target membership.
// The diff-roster (Pass 2) does email-based matching and resolution;
// applyPaycorChange receives pre-resolved IDs. The Paycor employeeId
// fields are metadata logged to audit, not used for DB lookups until
// we add paycorEmployeeId to org_memberships in migration 0031.
// ---------------------------------------------------------------------------

export type ApplyContext = {
  orgId: string;
  membershipId?: string;
  userId?: string;
};

export type ApplyResult = {
  action: "created" | "deactivated" | "updated" | "skipped";
  userId?: string;
  membershipId?: string;
  details?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Paycor → AuditHalo status mapping
// ---------------------------------------------------------------------------

const TERMINATED_STATUSES = new Set<PaycorEmploymentStatus>([
  "Terminated",
  "Resigned",
  "Retired",
  "Deceased",
  "LaidOff",
]);

const LEAVE_STATUSES = new Set<PaycorEmploymentStatus>([
  "LongTermDisability",
  "ShortTermDisability",
  "Fmla",
  "LeaveWithPay",
  "LeaveWithoutPay",
  "WorkersCompensation",
  "ThirdPartyPayable",
]);

export type PaycorStatusMapping =
  | { disposition: "active"; leaveStatus: "active" }
  | { disposition: "terminated" }
  | { disposition: "on_leave"; leaveStatus: "on_leave" };

export function mapPaycorStatus(
  status: PaycorEmploymentStatus,
): PaycorStatusMapping {
  if (status === "Active")
    return { disposition: "active", leaveStatus: "active" };
  if (TERMINATED_STATUSES.has(status)) return { disposition: "terminated" };
  if (LEAVE_STATUSES.has(status))
    return { disposition: "on_leave", leaveStatus: "on_leave" };
  return { disposition: "active", leaveStatus: "active" };
}

// ---------------------------------------------------------------------------
// SeatCapExceededError — thrown by applyPaycorChange when employee_hired
// would exceed the org's seat limit. The caller (daily sync cron, Pass 2)
// catches this, logs the failure, and notifies HR Admin.
// ---------------------------------------------------------------------------

export class SeatCapExceededError extends Error {
  constructor(
    public readonly orgId: string,
    public readonly email: string,
    public readonly cap: number,
    public readonly used: number,
  ) {
    super(
      `Seat cap exceeded for org ${orgId}: ${used}/${cap} seats used, cannot add ${email}`,
    );
    this.name = "SeatCapExceededError";
  }
}
