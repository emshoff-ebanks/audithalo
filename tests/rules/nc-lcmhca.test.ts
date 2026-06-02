import { describe, it, expect } from "vitest";
import { evaluate, getRule } from "@/lib/rules";
import type { EvaluationContext } from "@/lib/rules";
import { buildLog } from "./_helpers";

const NC = getRule("NC", "LCMHCA", 1);
const ACCEPTED_CREDS = ["LCMHCS"];

describe("NC LCMHCA rule", () => {
  it("loads and identifies itself correctly", () => {
    expect(NC.jurisdiction).toBe("NC");
    expect(NC.license_code).toBe("LCMHCA");
    expect(NC.version).toBe(1);
    expect(NC.structured.total_practice_hours_required).toBe(3000);
    expect(NC.structured.total_supervision_hours_required).toBe(100);
  });

  it("blocks if the supervision contract has not been filed", () => {
    const ctx = buildLog({
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [0, 1, 2],
      individualSupDays: [3],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-02-01T00:00:00Z",
      // contractFiledAt intentionally omitted
    });
    const r = evaluate(ctx, NC);
    expect(r.compliant).toBe(false);
    expect(r.riskLevel).toBe("red");
    expect(r.gaps.find((g) => g.code === "pre_registration_required")).toBeTruthy();
  });

  it("blocks if a supervision session is missing supervisor credentials", () => {
    const ctx: EvaluationContext = {
      superviseeId: "x",
      startedAt: "2026-01-01T00:00:00Z",
      supervisionContractFiledAt: "2025-12-15T00:00:00Z",
      asOf: "2026-02-01T00:00:00Z",
      sessions: [
        { kind: "practice", id: "p0", date: "2026-01-02T00:00:00Z", durationHours: 8 },
        {
          kind: "supervision",
          id: "s0",
          date: "2026-01-05T00:00:00Z",
          durationHours: 1,
          sessionType: "individual",
          supervisorCredentials: ["LPC"], // not LCMHCS
        },
      ],
    };
    const r = evaluate(ctx, NC);
    expect(r.compliant).toBe(false);
    expect(r.gaps.find((g) => g.code === "supervisor_credential_required")).toBeTruthy();
  });

  it("blocks if a group session exceeds 12 attendees", () => {
    const ctx: EvaluationContext = {
      superviseeId: "x",
      startedAt: "2026-01-01T00:00:00Z",
      supervisionContractFiledAt: "2025-12-15T00:00:00Z",
      asOf: "2026-02-01T00:00:00Z",
      sessions: [
        { kind: "practice", id: "p0", date: "2026-01-02T00:00:00Z", durationHours: 8 },
        {
          kind: "supervision",
          id: "g0",
          date: "2026-01-05T00:00:00Z",
          durationHours: 2,
          sessionType: "group",
          supervisorCredentials: ["LCMHCS"],
          groupAttendees: 15,
        },
      ],
    };
    const r = evaluate(ctx, NC);
    expect(r.compliant).toBe(false);
    expect(r.gaps.find((g) => g.code === "group_size_limit")).toBeTruthy();
  });

  it("warns when individual supervision cadence exceeds 14 days", () => {
    // 30 days of practice with no individual sup → 30-day gap from practice start
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: Array.from({ length: 20 }, (_, i) => i + 1),
      individualSupDays: [], // none
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-02-01T00:00:00Z",
    });
    const r = evaluate(ctx, NC);
    expect(r.gaps.find((g) => g.code === "individual_supervision_cadence")).toBeTruthy();
    expect(r.riskLevel).toBe("yellow");
  });

  it("is green and compliant for a healthy log meeting cadence + ratio", () => {
    // 90 days of practice (8 hr/day Mon-Fri = ~80 days at full schedule), ind sup every 14 days
    const practiceDays = Array.from({ length: 60 }, (_, i) => i + 1);
    // Individual sup every 14 days
    const indDays = [7, 21, 35, 49];
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays,
      individualSupDays: indDays,
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-03-01T00:00:00Z",
    });
    const r = evaluate(ctx, NC);
    expect(r.compliant).toBe(true); // no blockers
    expect(r.riskLevel).not.toBe("red");
  });

  it("computes correct totals", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3, 4, 5], // 5 * 8 = 40 practice hours
      individualSupDays: [7, 14, 21], // 3 hours individual
      groupSupDays: [10], // 2 hours group
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-02-01T00:00:00Z",
    });
    const r = evaluate(ctx, NC);
    expect(r.totals.practiceHours).toBe(40);
    expect(r.totals.supervisionHours).toBe(5);
    expect(r.totals.individualSupervisionHours).toBe(3);
    expect(r.totals.groupSupervisionHours).toBe(2);
  });

  it("reports progress percentages capped at 100", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: Array.from({ length: 400 }, (_, i) => i + 1), // 3200 practice hours
      individualSupDays: Array.from({ length: 110 }, (_, i) => i * 4), // > 100 sup hours
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2027-06-01T00:00:00Z",
    });
    const r = evaluate(ctx, NC);
    expect(r.progress.practiceProgressPct).toBe(100);
    expect(r.progress.supervisionProgressPct).toBe(100);
  });
});
