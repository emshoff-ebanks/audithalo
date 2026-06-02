import { describe, it, expect } from "vitest";
import { evaluate, getRule } from "@/lib/rules";
import type { EvaluationContext } from "@/lib/rules";
import { buildLog } from "./_helpers";

const CA = getRule("CA", "APCC", 1);
// CA's supervisor pool is unusually broad (16 CCR §1820): any of these 5
// California license types satisfy the supervisor_credential_required check.
const ACCEPTED_CREDS = ["LPCC", "LMFT", "LCSW", "Psychologist", "Psychiatrist"];
const BAD_CRED = "LCMHCS"; // NC-only credential — not accepted in CA

describe("CA APCC rule", () => {
  it("loads and identifies itself correctly", () => {
    expect(CA.jurisdiction).toBe("CA");
    expect(CA.license_code).toBe("APCC");
    expect(CA.version).toBe(1);
    expect(CA.structured.total_practice_hours_required).toBe(3000);
    // Per YAML notes: this 100 figure is a PLACEHOLDER (CA uses weekly cadence,
    // not a fixed total). We assert the structural number reflects the YAML.
    expect(CA.structured.total_supervision_hours_required).toBe(100);
    expect(CA.structured.min_duration_months).toBe(24);
    expect(CA.structured.max_duration_months).toBe(72);
    expect(CA.structured.group_max_attendees).toBe(8);
  });

  it("blocks if the APCC registration (contract) has not been filed", () => {
    const ctx = buildLog({
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [0, 1, 2],
      individualSupDays: [3],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-10T00:00:00Z",
      // contractFiledAt intentionally omitted
    });
    const r = evaluate(ctx, CA);
    expect(r.compliant).toBe(false);
    expect(r.riskLevel).toBe("red");
    expect(r.gaps.find((g) => g.code === "pre_registration_required")).toBeTruthy();
  });

  it("blocks if a supervision session has a non-accepted credential", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3],
      individualSupDays: [4],
      supervisorCredentials: [BAD_CRED],
      asOf: "2026-01-10T00:00:00Z",
    });
    const r = evaluate(ctx, CA);
    expect(r.compliant).toBe(false);
    const credGap = r.gaps.find((g) => g.code === "supervisor_credential_required");
    expect(credGap).toBeTruthy();
    expect(credGap!.severity).toBe("blocker");
  });

  it("accepts each individual CA-qualifying credential", () => {
    for (const cred of ACCEPTED_CREDS) {
      const ctx = buildLog({
        contractFiledAt: "2025-12-15T00:00:00Z",
        startedAt: "2026-01-01T00:00:00Z",
        practiceDays: [1, 2, 3],
        individualSupDays: [4],
        supervisorCredentials: [cred],
        asOf: "2026-01-08T00:00:00Z",
      });
      const r = evaluate(ctx, CA);
      expect(r.gaps.find((g) => g.code === "supervisor_credential_required")).toBeUndefined();
    }
  });

  it("blocks if a group session exceeds the CA cap of 8 attendees", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3],
      individualSupDays: [4],
      groupSupDays: [5],
      groupAttendees: 9, // cap is 8
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-10T00:00:00Z",
    });
    const r = evaluate(ctx, CA);
    expect(r.compliant).toBe(false);
    expect(r.gaps.find((g) => g.code === "group_size_limit")).toBeTruthy();
  });

  it("does NOT block a group session at the CA cap (exactly 8)", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3],
      individualSupDays: [4],
      groupSupDays: [5],
      groupAttendees: 8,
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-10T00:00:00Z",
    });
    const r = evaluate(ctx, CA);
    expect(r.gaps.find((g) => g.code === "group_size_limit")).toBeUndefined();
  });

  it("warns when individual supervision cadence exceeds CA's 7-day max gap", () => {
    // 20 days of practice with no individual sup → gap >> 7 days
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: Array.from({ length: 15 }, (_, i) => i + 1),
      individualSupDays: [],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-25T00:00:00Z",
    });
    const r = evaluate(ctx, CA);
    expect(r.gaps.find((g) => g.code === "individual_supervision_cadence")).toBeTruthy();
    expect(r.riskLevel).toBe("yellow");
  });

  it("is green and compliant for a healthy log meeting CA's 7-day cadence", () => {
    // Weekly individual sup for ~8 weeks of practice
    const practiceDays = Array.from({ length: 40 }, (_, i) => i + 1);
    const indDays = [6, 13, 20, 27, 34, 41]; // every 7 days
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays,
      individualSupDays: indDays,
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-02-12T00:00:00Z",
    });
    const r = evaluate(ctx, CA);
    expect(r.compliant).toBe(true);
    expect(r.riskLevel).not.toBe("red");
  });

  it("warns when the obligation exceeds CA's 72-month max duration window", () => {
    // Start in 2018, evaluate in 2026 → ~96 months > 72-month max
    const ctx = buildLog({
      contractFiledAt: "2017-12-15T00:00:00Z",
      startedAt: "2018-01-01T00:00:00Z",
      practiceDays: [1, 30, 60],
      individualSupDays: [7, 14, 21, 28, 35, 42, 49, 56],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-01T00:00:00Z",
    });
    const r = evaluate(ctx, CA);
    const durationGap = r.gaps.find((g) => g.code === "duration_window");
    expect(durationGap).toBeTruthy();
    expect(durationGap!.severity).toBe("warning");
  });

  it("computes correct totals for CA sessions", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3, 4], // 32 practice hours
      individualSupDays: [5, 12], // 2 hours individual
      groupSupDays: [8], // 2 hours group
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-02-01T00:00:00Z",
    });
    const r = evaluate(ctx, CA);
    expect(r.totals.practiceHours).toBe(32);
    expect(r.totals.supervisionHours).toBe(4);
    expect(r.totals.individualSupervisionHours).toBe(2);
    expect(r.totals.groupSupervisionHours).toBe(2);
  });

  it("reports CA progress percentages capped at 100", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: Array.from({ length: 400 }, (_, i) => i + 1), // 3200 practice
      individualSupDays: Array.from({ length: 110 }, (_, i) => i * 4),
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2027-06-01T00:00:00Z",
    });
    const r = evaluate(ctx, CA);
    expect(r.progress.practiceProgressPct).toBe(100);
    expect(r.progress.supervisionProgressPct).toBe(100);
  });
});
