import { describe, it, expect } from "vitest";
import { evaluate, getRule } from "@/lib/rules";
import type { EvaluationContext } from "@/lib/rules";
import { buildLog } from "./_helpers";

const NY = getRule("NY", "LMHC-LP", 1);
// New York has the broadest supervisor pool of any state we cover — 7
// different license types qualify per the YAML's accepted_credentials list.
const ACCEPTED_CREDS = ["LMHC", "LCSW", "Psychologist", "Psychiatrist", "LMFT", "LCAT", "LP"];
const BAD_CRED = "LCMHCS"; // NC-only credential — not accepted in NY

describe("NY LMHC-LP rule", () => {
  it("loads and identifies itself correctly", () => {
    expect(NY.jurisdiction).toBe("NY");
    expect(NY.license_code).toBe("LMHC-LP");
    expect(NY.version).toBe(1);
    expect(NY.structured.total_practice_hours_required).toBe(3000);
    expect(NY.structured.total_supervision_hours_required).toBe(100);
    expect(NY.structured.min_duration_months).toBe(12);
    // 2-year initial permit + 1-year renewal = 36 months hard cap.
    expect(NY.structured.max_duration_months).toBe(36);
    expect(NY.structured.group_max_attendees).toBe(8);
  });

  it("blocks if the Limited Permit has not been issued by NYSED", () => {
    const ctx = buildLog({
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [0, 1, 2],
      individualSupDays: [3],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-02-01T00:00:00Z",
      // contractFiledAt intentionally omitted
    });
    const r = evaluate(ctx, NY);
    expect(r.compliant).toBe(false);
    expect(r.riskLevel).toBe("red");
    expect(r.gaps.find((g) => g.code === "pre_registration_required")).toBeTruthy();
  });

  it("blocks when the supervisor credential is not on NY's accepted list", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3],
      individualSupDays: [4],
      supervisorCredentials: [BAD_CRED],
      asOf: "2026-01-20T00:00:00Z",
    });
    const r = evaluate(ctx, NY);
    expect(r.compliant).toBe(false);
    const credGap = r.gaps.find((g) => g.code === "supervisor_credential_required");
    expect(credGap).toBeTruthy();
    expect(credGap!.severity).toBe("blocker");
  });

  it("accepts each individual NY-qualifying credential (broadest pool)", () => {
    // NY accepts 7 license types — verify each one individually passes the check.
    for (const cred of ACCEPTED_CREDS) {
      const ctx = buildLog({
        contractFiledAt: "2025-12-15T00:00:00Z",
        startedAt: "2026-01-01T00:00:00Z",
        practiceDays: [1, 2, 3],
        individualSupDays: [4, 10],
        supervisorCredentials: [cred],
        asOf: "2026-01-20T00:00:00Z",
      });
      const r = evaluate(ctx, NY);
      expect(r.gaps.find((g) => g.code === "supervisor_credential_required")).toBeUndefined();
    }
  });

  it("blocks if a group session exceeds NY's cap of 8 attendees", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3],
      individualSupDays: [4],
      groupSupDays: [5],
      groupAttendees: 9, // cap is 8
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-20T00:00:00Z",
    });
    const r = evaluate(ctx, NY);
    expect(r.compliant).toBe(false);
    expect(r.gaps.find((g) => g.code === "group_size_limit")).toBeTruthy();
  });

  it("warns when individual supervision cadence exceeds NY's 14-day proxy", () => {
    // NY uses qualitative "regular and consistent" — the YAML proxies with 14 days.
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: Array.from({ length: 25 }, (_, i) => i + 1),
      individualSupDays: [],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-02-10T00:00:00Z",
    });
    const r = evaluate(ctx, NY);
    expect(r.gaps.find((g) => g.code === "individual_supervision_cadence")).toBeTruthy();
    expect(r.riskLevel).toBe("yellow");
  });

  it("is green and compliant for a healthy NY log meeting bi-weekly cadence", () => {
    const practiceDays = Array.from({ length: 60 }, (_, i) => i + 1);
    const indDays = [7, 21, 35, 49];
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays,
      individualSupDays: indDays,
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-03-01T00:00:00Z",
    });
    const r = evaluate(ctx, NY);
    expect(r.compliant).toBe(true);
    expect(r.riskLevel).not.toBe("red");
  });

  it("warns when the obligation exceeds NY's 36-month permit cap (2 yr + 1 yr renewal)", () => {
    // Started in 2022, evaluated in 2026 → ~48 months > 36-month max
    const ctx = buildLog({
      contractFiledAt: "2021-12-15T00:00:00Z",
      startedAt: "2022-01-01T00:00:00Z",
      practiceDays: [1, 30, 60],
      individualSupDays: [15, 45],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-01T00:00:00Z",
    });
    const r = evaluate(ctx, NY);
    const durationGap = r.gaps.find((g) => g.code === "duration_window");
    expect(durationGap).toBeTruthy();
    expect(durationGap!.severity).toBe("warning");
  });

  it("warns when NY permit is within 90 days of its expiration window", () => {
    // Started 58 months ago — ~61 days remaining against the 60-month cap,
    // inside the 90-day warning window for permit_expiration_window.
    const monthsAgo = 58;
    const ctx: EvaluationContext = {
      superviseeId: "x",
      startedAt: new Date(Date.now() - monthsAgo * 30.44 * 24 * 60 * 60 * 1000).toISOString(),
      supervisionContractFiledAt: new Date(Date.now() - monthsAgo * 30.44 * 24 * 60 * 60 * 1000).toISOString(),
      asOf: new Date().toISOString(),
      sessions: [],
    };
    const r = evaluate(ctx, NY);
    const gap = r.gaps.find((g) => g.code === "permit_expiration_window");
    expect(gap).toBeTruthy();
    expect(gap!.severity).toBe("warning");
  });

  it("computes correct totals for NY sessions", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3, 4, 5, 6, 7], // 56 practice hours
      individualSupDays: [8, 22, 36], // 3 hours individual
      groupSupDays: [15], // 2 hours group
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-03-01T00:00:00Z",
    });
    const r = evaluate(ctx, NY);
    expect(r.totals.practiceHours).toBe(56);
    expect(r.totals.supervisionHours).toBe(5);
    expect(r.totals.individualSupervisionHours).toBe(3);
    expect(r.totals.groupSupervisionHours).toBe(2);
  });

  it("reports NY progress percentages capped at 100", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: Array.from({ length: 400 }, (_, i) => i + 1), // > 3000
      individualSupDays: Array.from({ length: 110 }, (_, i) => i * 4), // > 100
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2027-06-01T00:00:00Z",
    });
    const r = evaluate(ctx, NY);
    expect(r.progress.practiceProgressPct).toBe(100);
    expect(r.progress.supervisionProgressPct).toBe(100);
  });
});
