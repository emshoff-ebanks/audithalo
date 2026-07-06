import { describe, it, expect } from "vitest";
import {
  mapPaycorStatus,
  SeatCapExceededError,
  PAYCOR_EMPLOYMENT_STATUSES,
} from "@/lib/hris/types";
import type {
  PaycorEmployee,
  PaycorChange,
  PaycorStatusMapping,
} from "@/lib/hris/types";
import { MockPaycorProvider } from "@/lib/hris/paycor-provider";

// ---------------------------------------------------------------------------
// mapPaycorStatus — pure mapping from Paycor's 13 statuses to AuditHalo
// ---------------------------------------------------------------------------

describe("mapPaycorStatus", () => {
  it("maps Active to active disposition", () => {
    expect(mapPaycorStatus("Active")).toEqual({
      disposition: "active",
      leaveStatus: "active",
    });
  });

  it.each(["Terminated", "Resigned", "Retired", "Deceased", "LaidOff"] as const)(
    "maps %s to terminated disposition",
    (status) => {
      const result = mapPaycorStatus(status);
      expect(result.disposition).toBe("terminated");
      expect(result).not.toHaveProperty("leaveStatus");
    },
  );

  it.each([
    "LongTermDisability",
    "ShortTermDisability",
    "Fmla",
    "LeaveWithPay",
    "LeaveWithoutPay",
    "WorkersCompensation",
    "ThirdPartyPayable",
  ] as const)("maps %s to on_leave disposition", (status) => {
    expect(mapPaycorStatus(status)).toEqual({
      disposition: "on_leave",
      leaveStatus: "on_leave",
    });
  });

  it("covers all 13 Paycor employment statuses", () => {
    expect(PAYCOR_EMPLOYMENT_STATUSES).toHaveLength(13);
    for (const status of PAYCOR_EMPLOYMENT_STATUSES) {
      const result = mapPaycorStatus(status);
      expect(["active", "terminated", "on_leave"]).toContain(result.disposition);
    }
  });

  it("returns correct leaveStatus for non-terminated dispositions", () => {
    const activeResult = mapPaycorStatus("Active") as Extract<
      PaycorStatusMapping,
      { disposition: "active" }
    >;
    expect(activeResult.leaveStatus).toBe("active");

    const leaveResult = mapPaycorStatus("Fmla") as Extract<
      PaycorStatusMapping,
      { disposition: "on_leave" }
    >;
    expect(leaveResult.leaveStatus).toBe("on_leave");
  });
});

// ---------------------------------------------------------------------------
// SeatCapExceededError
// ---------------------------------------------------------------------------

describe("SeatCapExceededError", () => {
  it("extends Error with correct name", () => {
    const err = new SeatCapExceededError("org-1", "test@example.com", 3, 3);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("SeatCapExceededError");
  });

  it("exposes orgId, email, cap, and used as properties", () => {
    const err = new SeatCapExceededError("org-1", "j@ri.org", 5, 5);
    expect(err.orgId).toBe("org-1");
    expect(err.email).toBe("j@ri.org");
    expect(err.cap).toBe(5);
    expect(err.used).toBe(5);
  });

  it("includes identifiers in the error message", () => {
    const err = new SeatCapExceededError("org-abc", "bree@ri.org", 10, 10);
    expect(err.message).toContain("org-abc");
    expect(err.message).toContain("bree@ri.org");
    expect(err.message).toContain("10/10");
  });
});

// ---------------------------------------------------------------------------
// MockPaycorProvider
// ---------------------------------------------------------------------------

describe("MockPaycorProvider", () => {
  function makeEmployee(overrides: Partial<PaycorEmployee> = {}): PaycorEmployee {
    return {
      paycorEmployeeId: "pc-001",
      firstName: "Jordan",
      lastName: "Williams",
      email: "jordan@ri.org",
      status: "Active",
      jobTitle: "Clinician",
      managerId: null,
      hireDate: new Date("2024-01-15"),
      terminationDate: null,
      ...overrides,
    };
  }

  it("returns empty array for unknown legalEntityId", async () => {
    const provider = new MockPaycorProvider();
    const result = await provider.fetchEmployees("unknown");
    expect(result).toEqual([]);
  });

  it("returns configured employees for a legal entity", async () => {
    const provider = new MockPaycorProvider();
    const employees = [
      makeEmployee({ paycorEmployeeId: "pc-001" }),
      makeEmployee({ paycorEmployeeId: "pc-002", email: "sarah@ri.org" }),
    ];
    provider.setEmployees("le-100", employees);

    const result = await provider.fetchEmployees("le-100");
    expect(result).toHaveLength(2);
    expect(result[0].paycorEmployeeId).toBe("pc-001");
    expect(result[1].email).toBe("sarah@ri.org");
  });

  it("replaces employees when setEmployees is called again", async () => {
    const provider = new MockPaycorProvider();
    provider.setEmployees("le-100", [makeEmployee()]);
    provider.setEmployees("le-100", []);

    const result = await provider.fetchEmployees("le-100");
    expect(result).toEqual([]);
  });

  it("returns configured status for a known employee", async () => {
    const provider = new MockPaycorProvider();
    provider.setStatus("pc-001", {
      employeeId: "pc-001",
      status: "Fmla",
      leaveStartDate: new Date("2026-07-01"),
      leaveReason: "Maternity Leave",
    });

    const result = await provider.fetchEmployeeStatus("pc-001");
    expect(result.status).toBe("Fmla");
    expect(result.leaveReason).toBe("Maternity Leave");
  });

  it("throws for unknown employee status", async () => {
    const provider = new MockPaycorProvider();
    await expect(provider.fetchEmployeeStatus("unknown")).rejects.toThrow(
      "Mock: no status configured for employee unknown",
    );
  });

  it("isolates employees across legal entities", async () => {
    const provider = new MockPaycorProvider();
    provider.setEmployees("le-100", [makeEmployee({ email: "a@ri.org" })]);
    provider.setEmployees("le-200", [makeEmployee({ email: "b@ri.org" })]);

    const a = await provider.fetchEmployees("le-100");
    const b = await provider.fetchEmployees("le-200");
    expect(a[0].email).toBe("a@ri.org");
    expect(b[0].email).toBe("b@ri.org");
  });
});

// ---------------------------------------------------------------------------
// PaycorChange type — compile-time checks via type assertions
// ---------------------------------------------------------------------------

describe("PaycorChange type shapes", () => {
  it("constructs employee_hired change", () => {
    const change: PaycorChange = {
      kind: "employee_hired",
      employee: {
        paycorEmployeeId: "pc-001",
        firstName: "Jordan",
        lastName: "Williams",
        email: "jordan@ri.org",
        status: "Active",
        jobTitle: "Clinician",
        managerId: null,
        hireDate: new Date("2024-01-15"),
        terminationDate: null,
      },
      role: "supervisee",
    };
    expect(change.kind).toBe("employee_hired");
    expect(change.employee.email).toBe("jordan@ri.org");
    expect(change.role).toBe("supervisee");
  });

  it("constructs employee_terminated change", () => {
    const change: PaycorChange = {
      kind: "employee_terminated",
      employeeId: "pc-001",
      terminatedAt: new Date("2026-07-01"),
    };
    expect(change.kind).toBe("employee_terminated");
    expect(change.terminatedAt).toBeInstanceOf(Date);
  });

  it("constructs leave_status_changed change", () => {
    const change: PaycorChange = {
      kind: "leave_status_changed",
      employeeId: "pc-001",
      status: "on_leave",
      effectiveAt: new Date("2026-07-01"),
    };
    expect(change.kind).toBe("leave_status_changed");
    expect(change.status).toBe("on_leave");
  });

  it("constructs role_changed change", () => {
    const change: PaycorChange = {
      kind: "role_changed",
      employeeId: "pc-001",
      auditHaloRole: "supervisor",
    };
    expect(change.kind).toBe("role_changed");
    expect(change.auditHaloRole).toBe("supervisor");
  });
});
