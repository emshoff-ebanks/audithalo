import { describe, it, expect } from "vitest";
import { evaluate } from "@/lib/rules/evaluator";
import { getRule } from "@/lib/rules/loader";
import type { EvaluationContext } from "@/lib/rules/types";

/**
 * Wave 2 / Phase 1.1 regression — locks the behavior Bree confirmed on
 * 2026-06-25: on_leave pauses the cadence checks; PRN does NOT.
 */

// NC LCMHCA is the founder-verified rule; it includes the cadence checks
// `individual_supervision_cadence` we expect to pause on on_leave.
const NC_LCMHCA = getRule("NC", "LCMHCA", 1);

function ctx(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  const sixMonthsAgo = new Date("2026-01-01T00:00:00Z").toISOString();
  return {
    superviseeId: "u1",
    startedAt: sixMonthsAgo,
    supervisionContractFiledAt: sixMonthsAgo,
    sessions: [
      // 80 hours of practice over 6 months — plenty of practice to
      // trigger the cadence check ("individual supervision gap exceeds
      // maximum") if no supervisions are logged.
      {
        kind: "practice",
        id: "p1",
        date: "2026-01-15T00:00:00Z",
        durationHours: 80,
      },
    ],
    asOf: "2026-06-29T00:00:00Z",
    leaveStatus: "active",
    ...overrides,
  };
}

describe("evaluator leave-status pause", () => {
  it("active context produces cadence gaps when supervision is missing", () => {
    const result = evaluate(ctx(), NC_LCMHCA);
    const cadenceGaps = result.gaps.filter(
      (g) => g.code === "individual_supervision_cadence"
    );
    expect(cadenceGaps.length).toBeGreaterThan(0);
    expect(result.paused).toBe(false);
  });

  it("on_leave context SKIPS cadence gaps", () => {
    const result = evaluate(ctx({ leaveStatus: "on_leave" }), NC_LCMHCA);
    const cadenceGaps = result.gaps.filter(
      (g) => g.code === "individual_supervision_cadence"
    );
    expect(cadenceGaps).toEqual([]);
    expect(result.paused).toBe(true);
  });

  it("PRN context does NOT skip cadence gaps (Bree 2026-06-25)", () => {
    const result = evaluate(ctx({ leaveStatus: "prn" }), NC_LCMHCA);
    const cadenceGaps = result.gaps.filter(
      (g) => g.code === "individual_supervision_cadence"
    );
    expect(cadenceGaps.length).toBeGreaterThan(0);
    expect(result.paused).toBe(false);
  });

  it("on_leave still computes totals + non-cadence gaps", () => {
    const result = evaluate(ctx({ leaveStatus: "on_leave" }), NC_LCMHCA);
    // Practice hours still tally even when paused.
    expect(result.totals.practiceHours).toBe(80);
    // total_practice_hours gap should still surface if they're under the
    // required total — this check has nothing to do with cadence.
    const totalGap = result.gaps.find(
      (g) => g.code === "total_practice_hours"
    );
    expect(totalGap).toBeDefined();
  });

  it("default (omitted leaveStatus) treats as active", () => {
    const result = evaluate(
      { ...ctx(), leaveStatus: undefined } as EvaluationContext,
      NC_LCMHCA
    );
    expect(result.paused).toBe(false);
  });
});
