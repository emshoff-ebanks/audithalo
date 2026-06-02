import { describe, it, expect } from "vitest";
import { evaluate, getRule } from "@/lib/rules";
import type { EvaluationContext } from "@/lib/rules";
import { buildLog } from "./_helpers";

const TX = getRule("TX", "LPC-Associate", 1);
// Texas requires the LPC-Supervisor designation specifically — a plain LPC
// license is not enough (22 TAC §681).
const ACCEPTED_CREDS = ["LPC-Supervisor"];
const BAD_CRED = "LPC"; // plain LPC without the Supervisor designation

describe("TX LPC-Associate rule", () => {
  it("loads and identifies itself correctly", () => {
    expect(TX.jurisdiction).toBe("TX");
    expect(TX.license_code).toBe("LPC-Associate");
    expect(TX.version).toBe(1);
    expect(TX.structured.total_practice_hours_required).toBe(3000);
    expect(TX.structured.total_supervision_hours_required).toBe(72);
    expect(TX.structured.min_duration_months).toBe(18);
    expect(TX.structured.max_duration_months).toBe(60);
    expect(TX.structured.group_max_attendees).toBe(12);
  });

  it("blocks if the Supervisory Agreement has not been filed", () => {
    const ctx = buildLog({
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [0, 1, 2],
      individualSupDays: [3],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-02-01T00:00:00Z",
      // contractFiledAt intentionally omitted
    });
    const r = evaluate(ctx, TX);
    expect(r.compliant).toBe(false);
    expect(r.riskLevel).toBe("red");
    expect(r.gaps.find((g) => g.code === "pre_registration_required")).toBeTruthy();
  });

  it("blocks when the supervisor lacks the LPC-Supervisor designation", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3],
      individualSupDays: [4],
      supervisorCredentials: [BAD_CRED], // plain LPC, not LPC-Supervisor
      asOf: "2026-02-01T00:00:00Z",
    });
    const r = evaluate(ctx, TX);
    expect(r.compliant).toBe(false);
    const credGap = r.gaps.find((g) => g.code === "supervisor_credential_required");
    expect(credGap).toBeTruthy();
    expect(credGap!.severity).toBe("blocker");
  });

  it("accepts a session with the LPC-Supervisor credential", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3],
      individualSupDays: [10],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-25T00:00:00Z",
    });
    const r = evaluate(ctx, TX);
    expect(r.gaps.find((g) => g.code === "supervisor_credential_required")).toBeUndefined();
  });

  it("blocks if a group session exceeds the TX cap of 12 attendees", () => {
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
          supervisorCredentials: ACCEPTED_CREDS,
          groupAttendees: 13, // cap is 12
        },
      ],
    };
    const r = evaluate(ctx, TX);
    expect(r.compliant).toBe(false);
    expect(r.gaps.find((g) => g.code === "group_size_limit")).toBeTruthy();
  });

  it("warns when individual supervision cadence exceeds TX's 30-day max gap", () => {
    // 60 days of practice with no individual sup → gap >> 30 days
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: Array.from({ length: 40 }, (_, i) => i + 1),
      individualSupDays: [],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-03-15T00:00:00Z",
    });
    const r = evaluate(ctx, TX);
    expect(r.gaps.find((g) => g.code === "individual_supervision_cadence")).toBeTruthy();
    expect(r.riskLevel).toBe("yellow");
  });

  it("is green and compliant for a healthy TX log with monthly individual sup", () => {
    // Monthly individual sup (every ~28 days, under the 30-day max)
    const practiceDays = Array.from({ length: 90 }, (_, i) => i + 1);
    const indDays = [14, 42, 70, 98]; // every ~28 days
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays,
      individualSupDays: indDays,
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-04-15T00:00:00Z",
    });
    const r = evaluate(ctx, TX);
    expect(r.compliant).toBe(true);
    expect(r.riskLevel).not.toBe("red");
  });

  it("warns when the obligation exceeds TX's 60-month max duration window", () => {
    // Started in 2020, evaluated in 2026 → ~72 months > 60-month max
    const ctx = buildLog({
      contractFiledAt: "2019-12-15T00:00:00Z",
      startedAt: "2020-01-01T00:00:00Z",
      practiceDays: [1, 30, 60],
      individualSupDays: [15, 45, 75],
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-01-01T00:00:00Z",
    });
    const r = evaluate(ctx, TX);
    const durationGap = r.gaps.find((g) => g.code === "duration_window");
    expect(durationGap).toBeTruthy();
    expect(durationGap!.severity).toBe("warning");
  });

  it("computes correct totals for TX sessions", () => {
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: [1, 2, 3, 4, 5, 6], // 48 practice hours
      individualSupDays: [10, 40], // 2 hours individual
      groupSupDays: [25], // 2 hours group
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2026-03-01T00:00:00Z",
    });
    const r = evaluate(ctx, TX);
    expect(r.totals.practiceHours).toBe(48);
    expect(r.totals.supervisionHours).toBe(4);
    expect(r.totals.individualSupervisionHours).toBe(2);
    expect(r.totals.groupSupervisionHours).toBe(2);
  });

  it("reports TX progress percentages capped at 100", () => {
    // 3000 / 8 = 375 practice days exactly, 72 / 1 = 72 individual sup days minimum
    const ctx = buildLog({
      contractFiledAt: "2025-12-15T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      practiceDays: Array.from({ length: 400 }, (_, i) => i + 1), // 3200 practice
      individualSupDays: Array.from({ length: 80 }, (_, i) => i * 5), // 80 sup hours > 72
      supervisorCredentials: ACCEPTED_CREDS,
      asOf: "2027-06-01T00:00:00Z",
    });
    const r = evaluate(ctx, TX);
    expect(r.progress.practiceProgressPct).toBe(100);
    expect(r.progress.supervisionProgressPct).toBe(100);
  });
});
