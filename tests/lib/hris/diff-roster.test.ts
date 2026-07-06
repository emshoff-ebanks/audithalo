import { describe, it, expect } from "vitest";
import { diffRoster } from "@/lib/hris/diff-roster";
import type { CurrentMember } from "@/lib/hris/diff-roster";
import type { PaycorEmployee } from "@/lib/hris/types";

const ORG_ID = "org-ri-test";

function makePaycorEmployee(
  overrides: Partial<PaycorEmployee> = {},
): PaycorEmployee {
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

function makeMember(overrides: Partial<CurrentMember> = {}): CurrentMember {
  return {
    membershipId: "mem-001",
    userId: "user-001",
    email: "jordan@ri.org",
    role: "supervisee",
    deactivatedAt: null,
    leaveStatus: "active",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// New hires
// ---------------------------------------------------------------------------

describe("diffRoster — new hires", () => {
  it("detects a new active employee not in AuditHalo", () => {
    const diffs = diffRoster(
      [makePaycorEmployee({ email: "new@ri.org" })],
      [],
      ORG_ID,
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].change.kind).toBe("employee_hired");
    expect(diffs[0].context.orgId).toBe(ORG_ID);
  });

  it("defaults new hires to supervisee role", () => {
    const diffs = diffRoster(
      [makePaycorEmployee({ email: "new@ri.org" })],
      [],
      ORG_ID,
    );
    const change = diffs[0].change;
    if (change.kind === "employee_hired") {
      expect(change.role).toBe("supervisee");
    }
  });

  it("skips employees already terminated in Paycor", () => {
    const diffs = diffRoster(
      [
        makePaycorEmployee({
          email: "gone@ri.org",
          status: "Terminated",
        }),
      ],
      [],
      ORG_ID,
    );
    expect(diffs).toHaveLength(0);
  });

  it("hires an employee on FMLA leave (non-terminated)", () => {
    const diffs = diffRoster(
      [makePaycorEmployee({ email: "leave@ri.org", status: "Fmla" })],
      [],
      ORG_ID,
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].change.kind).toBe("employee_hired");
  });

  it("deduplicates by email — existing member not re-hired", () => {
    const diffs = diffRoster(
      [makePaycorEmployee({ email: "jordan@ri.org" })],
      [makeMember({ email: "jordan@ri.org" })],
      ORG_ID,
    );
    const hires = diffs.filter((d) => d.change.kind === "employee_hired");
    expect(hires).toHaveLength(0);
  });

  it("case-insensitive email matching prevents duplicates", () => {
    const diffs = diffRoster(
      [makePaycorEmployee({ email: "JORDAN@RI.ORG" })],
      [makeMember({ email: "jordan@ri.org" })],
      ORG_ID,
    );
    const hires = diffs.filter((d) => d.change.kind === "employee_hired");
    expect(hires).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Reactivation
// ---------------------------------------------------------------------------

describe("diffRoster — reactivation", () => {
  it("reactivates a deactivated member who is active in Paycor", () => {
    const diffs = diffRoster(
      [makePaycorEmployee({ email: "jordan@ri.org", status: "Active" })],
      [makeMember({ deactivatedAt: new Date("2026-06-01") })],
      ORG_ID,
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].change.kind).toBe("employee_hired");
    expect(diffs[0].context.membershipId).toBe("mem-001");
  });

  it("does not reactivate a member still terminated in Paycor", () => {
    const diffs = diffRoster(
      [
        makePaycorEmployee({
          email: "jordan@ri.org",
          status: "Terminated",
        }),
      ],
      [makeMember({ deactivatedAt: new Date("2026-06-01") })],
      ORG_ID,
    );
    expect(diffs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Terminations
// ---------------------------------------------------------------------------

describe("diffRoster — terminations", () => {
  it("detects a termination when Paycor status is Terminated", () => {
    const diffs = diffRoster(
      [
        makePaycorEmployee({
          email: "jordan@ri.org",
          status: "Terminated",
          terminationDate: new Date("2026-07-01"),
        }),
      ],
      [makeMember()],
      ORG_ID,
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].change.kind).toBe("employee_terminated");
    if (diffs[0].change.kind === "employee_terminated") {
      expect(diffs[0].change.terminatedAt).toEqual(new Date("2026-07-01"));
    }
  });

  it("detects termination for Resigned status", () => {
    const diffs = diffRoster(
      [makePaycorEmployee({ email: "jordan@ri.org", status: "Resigned" })],
      [makeMember()],
      ORG_ID,
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].change.kind).toBe("employee_terminated");
  });

  it("skips already-deactivated members", () => {
    const diffs = diffRoster(
      [
        makePaycorEmployee({
          email: "jordan@ri.org",
          status: "Terminated",
        }),
      ],
      [makeMember({ deactivatedAt: new Date("2026-06-01") })],
      ORG_ID,
    );
    expect(diffs).toHaveLength(0);
  });

  it("uses current date when terminationDate is null", () => {
    const before = Date.now();
    const diffs = diffRoster(
      [
        makePaycorEmployee({
          email: "jordan@ri.org",
          status: "Terminated",
          terminationDate: null,
        }),
      ],
      [makeMember()],
      ORG_ID,
    );
    const after = Date.now();
    if (diffs[0].change.kind === "employee_terminated") {
      const ts = diffs[0].change.terminatedAt.getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    }
  });
});

// ---------------------------------------------------------------------------
// Leave status changes
// ---------------------------------------------------------------------------

describe("diffRoster — leave status changes", () => {
  it("detects active → on_leave when Paycor status is Fmla", () => {
    const diffs = diffRoster(
      [makePaycorEmployee({ email: "jordan@ri.org", status: "Fmla" })],
      [makeMember({ leaveStatus: "active" })],
      ORG_ID,
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].change.kind).toBe("leave_status_changed");
    if (diffs[0].change.kind === "leave_status_changed") {
      expect(diffs[0].change.status).toBe("on_leave");
    }
  });

  it("detects on_leave → active when Paycor status is Active", () => {
    const diffs = diffRoster(
      [makePaycorEmployee({ email: "jordan@ri.org", status: "Active" })],
      [makeMember({ leaveStatus: "on_leave" })],
      ORG_ID,
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].change.kind).toBe("leave_status_changed");
    if (diffs[0].change.kind === "leave_status_changed") {
      expect(diffs[0].change.status).toBe("active");
    }
  });

  it("no change when status matches", () => {
    const diffs = diffRoster(
      [makePaycorEmployee({ email: "jordan@ri.org", status: "Active" })],
      [makeMember({ leaveStatus: "active" })],
      ORG_ID,
    );
    expect(diffs).toHaveLength(0);
  });

  it("maps WorkersCompensation to on_leave", () => {
    const diffs = diffRoster(
      [
        makePaycorEmployee({
          email: "jordan@ri.org",
          status: "WorkersCompensation",
        }),
      ],
      [makeMember({ leaveStatus: "active" })],
      ORG_ID,
    );
    expect(diffs).toHaveLength(1);
    if (diffs[0].change.kind === "leave_status_changed") {
      expect(diffs[0].change.status).toBe("on_leave");
    }
  });

  it("skips leave changes for deactivated members", () => {
    const diffs = diffRoster(
      [makePaycorEmployee({ email: "jordan@ri.org", status: "Fmla" })],
      [
        makeMember({
          leaveStatus: "active",
          deactivatedAt: new Date("2026-06-01"),
        }),
      ],
      ORG_ID,
    );
    // Deactivated + non-terminated Paycor status → reactivation (employee_hired),
    // not a leave status change
    expect(diffs).toHaveLength(1);
    expect(diffs[0].change.kind).toBe("employee_hired");
  });
});

// ---------------------------------------------------------------------------
// Missing from Paycor
// ---------------------------------------------------------------------------

describe("diffRoster — members missing from Paycor", () => {
  it("does NOT auto-terminate members absent from Paycor roster", () => {
    const diffs = diffRoster(
      [],
      [makeMember({ email: "jordan@ri.org" })],
      ORG_ID,
    );
    expect(diffs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multiple employees
// ---------------------------------------------------------------------------

describe("diffRoster — batch scenarios", () => {
  it("handles mixed new hire + termination + status change in one roster", () => {
    const paycor = [
      makePaycorEmployee({
        paycorEmployeeId: "pc-001",
        email: "new@ri.org",
        status: "Active",
      }),
      makePaycorEmployee({
        paycorEmployeeId: "pc-002",
        email: "leaving@ri.org",
        status: "Terminated",
        terminationDate: new Date("2026-07-05"),
      }),
      makePaycorEmployee({
        paycorEmployeeId: "pc-003",
        email: "onleave@ri.org",
        status: "LeaveWithPay",
      }),
    ];
    const members = [
      makeMember({
        membershipId: "mem-002",
        userId: "user-002",
        email: "leaving@ri.org",
      }),
      makeMember({
        membershipId: "mem-003",
        userId: "user-003",
        email: "onleave@ri.org",
        leaveStatus: "active",
      }),
    ];

    const diffs = diffRoster(paycor, members, ORG_ID);
    const kinds = diffs.map((d) => d.change.kind).sort();
    expect(kinds).toEqual([
      "employee_hired",
      "employee_terminated",
      "leave_status_changed",
    ]);
  });

  it("produces no changes when rosters are in sync", () => {
    const paycor = [
      makePaycorEmployee({ email: "jordan@ri.org", status: "Active" }),
      makePaycorEmployee({ email: "sarah@ri.org", status: "Active" }),
    ];
    const members = [
      makeMember({ email: "jordan@ri.org", leaveStatus: "active" }),
      makeMember({
        membershipId: "mem-002",
        userId: "user-002",
        email: "sarah@ri.org",
        leaveStatus: "active",
      }),
    ];

    const diffs = diffRoster(paycor, members, ORG_ID);
    expect(diffs).toHaveLength(0);
  });
});
