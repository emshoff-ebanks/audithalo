import { describe, it, expect } from "vitest";
import { evaluate, getRule } from "@/lib/rules";
import type { EvaluationContext } from "@/lib/rules";
import { buildLog } from "./_helpers";

const FL = getRule("FL", "RMHCI", 1);
// Florida accepts FL Qualified Supervisor, plus LMHC/LMFT/LCSW/Psychologist
// per the YAML's accepted_credentials list (rule v1 — the YAML notes that the
// "QS designation" is the actual gating requirement, deferred to v2).
const ACCEPTED_CREDS = ["Qualified-Supervisor", "LMHC", "LMFT", "LCSW", "Psychologist"];
const BAD_CRED = "LCMHCS"; // NC-only credential — not accepted in FL

describe("FL RMHCI rule", () => {
  it("loads and identifies itself correctly", () => {
    expect(FL.jurisdiction).toBe("FL");
    expect(FL.license_code).toBe("RMHCI");
    expect(FL.version).toBe(1);
    // Florida has the lowest total in our coverage area — 1,500 hours.
    expect(FL.structured.total_practice_hours_required).toBe(1500);
    expect(FL.structured.total_supervision_hours_required).toBe(100);
    expect(FL.structured.min_duration_months).toBe(23);
    // 60-month NON-RENEWABLE registration is FL's defining feature.
    expect(FL.structured.max_duration_months).toBe(60);
    expect(FL.structured.group_max_attendees).toBe(6);
  });

  it("blocks if the RMHCI registration has not been issued", () => {
    const ctx = buildLog({
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [0, 1, 2],
      individualSupDays: [3],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-02-01T00:00:00Z",
      // contractFiledAt intentionally omitted
    });
    const r = evaluate(ctx, FL);
    expect(r.compliant).toBe(false);
    expect(r.riskLevel).toBe("red");
    expect(r.gaps.find((g) => g.code === "pre_registration_required")).toBeTruthy();
  });

  it("blocks when the supervisor credential is not accepted in FL", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3],
      individualSupDays: [4],
      supervisorCredentials: [BAD_CRED],
      asOf: "2026-01-20T00:00:00Z",
    });
    const r = evaluate(ctx, FL);
    expect(r.compliant).toBe(false);
    const credGap = r.gaps.find((g) => g.code === "supervisor_credential_required");
    expect(credGap).toBeTruthy();
    expect(credGap!.severity).toBe("blocker");
  });

  it("accepts each individual FL-qualifying credential", () => {
    for (const cred of ACCEPTED_CREDS) {
      const ctx = buildLog({
        contractFiledAt: "2025-12-15T00:00:00Z",
        startedAt: "2026-01-01T00:00:00Z",
        practiceDays: [1, 2, 3],
        individualSupDays: [4, 10],
        supervisorCredentials: [cred],
        asOf: "2026-01-20T00:00:00Z",
      });
      const r = evaluate(ctx, FL);
      expect(r.gaps.find((g) => g.code === "supervisor_credential_required")).toBeUndefined();
    }
  });

  it("blocks if a group session exceeds FL's cap of 6 attendees", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3],
      individualSupDays: [4],
      groupSupDays: [5],
      groupAttendees: 7, // cap is 6
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-20T00:00:00Z",
    });
    const r = evaluate(ctx, FL);
    expect(r.compliant).toBe(false);
    expect(r.gaps.find((g) => g.code === "group_size_limit")).toBeTruthy();
  });

  it("does NOT block a FL group session at the cap (exactly 6)", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3],
      individualSupDays: [4],
      groupSupDays: [5],
      groupAttendees: 6,
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-20T00:00:00Z",
    });
    const r = evaluate(ctx, FL);
    expect(r.gaps.find((g) => g.code === "group_size_limit")).toBeUndefined();
  });

  it("warns when individual supervision cadence exceeds FL's 14-day max gap", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: Array.from({ length: 20 }, (_, i) => i + 1),
      individualSupDays: [],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-02-01T00:00:00Z",
    });
    const r = evaluate(ctx, FL);
    expect(r.gaps.find((g) => g.code === "individual_supervision_cadence")).toBeTruthy();
    expect(r.riskLevel).toBe("yellow");
  });

  it("is green and compliant for a healthy FL log meeting bi-weekly cadence", () => {
    const practiceDays = Array.from({ length: 60 }, (_, i) => i + 1);
    const indDays = [7, 21, 35, 49]; // every 14 days, matches the cadence
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays,
      individualSupDays: indDays,
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-03-01T00:00:00Z",
    });
    const r = evaluate(ctx, FL);
    expect(r.compliant).toBe(true);
    expect(r.riskLevel).not.toBe("red");
  });

  it("warns when the obligation exceeds FL's 60-month non-renewable window", () => {
    // 6+ years of obligation → > 60 month cap
    const ctx = buildLog({
      contractFiledAt: "2019-12-15T00:00:00Z",
      startedAt: "2020-01-01T00:00:00Z",
      practiceDays: [1, 30, 60],
      individualSupDays: [15, 45],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-01T00:00:00Z",
    });
    const r = evaluate(ctx, FL);
    const durationGap = r.gaps.find((g) => g.code === "duration_window");
    expect(durationGap).toBeTruthy();
    expect(durationGap!.severity).toBe("warning");
  });

  it("computes correct totals for FL sessions", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3, 4, 5], // 40 practice hours
      individualSupDays: [6, 12], // 2 hours individual
      groupSupDays: [10], // 2 hours group
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-02-01T00:00:00Z",
    });
    const r = evaluate(ctx, FL);
    expect(r.totals.practiceHours).toBe(40);
    expect(r.totals.supervisionHours).toBe(4);
    expect(r.totals.individualSupervisionHours).toBe(2);
    expect(r.totals.groupSupervisionHours).toBe(2);
  });

  it("reports FL progress percentages capped at 100", () => {
    // 1500/8 = ~188 days to hit 100% practice; 100 ind sup hours = 100 sessions
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: Array.from({ length: 250 }, (_, i) => i + 1), // 2000 hrs > 1500
      individualSupDays: Array.from({ length: 120 }, (_, i) => i * 3), // > 100 sup hrs
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2027-06-01T00:00:00Z",
    });
    const r = evaluate(ctx, FL);
    expect(r.progress.practiceProgressPct).toBe(100);
    expect(r.progress.supervisionProgressPct).toBe(100);
  });
});
