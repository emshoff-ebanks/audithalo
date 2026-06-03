import { describe, it, expect } from "vitest";
import { computeOrgMetrics, bottomAtRisk } from "@/lib/dashboard-metrics";
import type { RosterRow } from "@/lib/db/roster-queries";
import type { EvaluationResult, RiskLevel } from "@/lib/rules/types";

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function makeEvaluation(
  riskLevel: RiskLevel,
  overrides: Partial<EvaluationResult> = {}
): EvaluationResult {
  return {
    ruleId: "nc-lcmhca-v1",
    evaluatedAt: "2026-06-03T00:00:00Z",
    totals: {
      practiceHours: 100,
      supervisionHours: 10,
      individualSupervisionHours: 6,
      triadicSupervisionHours: 2,
      groupSupervisionHours: 2,
    },
    progress: {
      practiceProgressPct: 50,
      supervisionProgressPct: 50,
    },
    compliant: riskLevel === "green",
    riskLevel,
    gaps: [],
    ...overrides,
  };
}

function makeRow(overrides: Partial<RosterRow> = {}): RosterRow {
  return {
    userId: "user-1",
    name: "Test User",
    email: "test@example.com",
    state: "NC",
    licenseType: "LCMHCA",
    ruleId: "nc-lcmhca-v1",
    obligationStartedAt: new Date("2026-01-01T00:00:00Z"),
    supervisionContractFiledAt: null,
    evaluation: makeEvaluation("green"),
    pendingSignatureCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeOrgMetrics
// ---------------------------------------------------------------------------

describe("computeOrgMetrics", () => {
  it("returns all zeros for an empty roster", () => {
    const m = computeOrgMetrics([]);
    expect(m).toEqual({
      totalSupervisees: 0,
      withEvaluation: 0,
      onTrack: 0,
      needsAttention: 0,
      atRisk: 0,
      unassigned: 0,
      totalPendingSignatures: 0,
      totalPracticeHours: 0,
      totalSupervisionHours: 0,
      complianceScorePct: 0,
    });
  });

  it("returns 100% compliance score for a single green supervisee", () => {
    const m = computeOrgMetrics([
      makeRow({
        evaluation: makeEvaluation("green", {
          totals: {
            practiceHours: 250,
            supervisionHours: 25,
            individualSupervisionHours: 15,
            triadicSupervisionHours: 5,
            groupSupervisionHours: 5,
          },
        }),
      }),
    ]);
    expect(m.totalSupervisees).toBe(1);
    expect(m.withEvaluation).toBe(1);
    expect(m.onTrack).toBe(1);
    expect(m.needsAttention).toBe(0);
    expect(m.atRisk).toBe(0);
    expect(m.unassigned).toBe(0);
    expect(m.complianceScorePct).toBe(100);
    expect(m.totalPracticeHours).toBe(250);
    expect(m.totalSupervisionHours).toBe(25);
  });

  it("computes correct counts and score for a mix of green/yellow/red/unassigned", () => {
    const m = computeOrgMetrics([
      makeRow({ userId: "u-green-1", evaluation: makeEvaluation("green") }),
      makeRow({ userId: "u-green-2", evaluation: makeEvaluation("green") }),
      makeRow({ userId: "u-yellow", evaluation: makeEvaluation("yellow") }),
      makeRow({ userId: "u-red", evaluation: makeEvaluation("red") }),
      makeRow({
        userId: "u-unassigned",
        ruleId: null,
        obligationStartedAt: null,
        evaluation: null,
      }),
    ]);
    expect(m.totalSupervisees).toBe(5);
    expect(m.withEvaluation).toBe(4);
    expect(m.onTrack).toBe(2);
    expect(m.needsAttention).toBe(1);
    expect(m.atRisk).toBe(1);
    expect(m.unassigned).toBe(1);
    // 2/4 = 50%
    expect(m.complianceScorePct).toBe(50);
  });

  it("excludes unassigned from compliance score denominator", () => {
    // 1 green + 3 unassigned -> 1/1 = 100% (not 1/4 = 25%)
    const m = computeOrgMetrics([
      makeRow({ userId: "u-green", evaluation: makeEvaluation("green") }),
      makeRow({ userId: "u-na-1", ruleId: null, evaluation: null }),
      makeRow({ userId: "u-na-2", ruleId: null, evaluation: null }),
      makeRow({ userId: "u-na-3", ruleId: null, evaluation: null }),
    ]);
    expect(m.withEvaluation).toBe(1);
    expect(m.unassigned).toBe(3);
    expect(m.complianceScorePct).toBe(100);
  });

  it("sums pending signatures across all rows including unassigned", () => {
    const m = computeOrgMetrics([
      makeRow({ userId: "u-a", pendingSignatureCount: 3 }),
      makeRow({ userId: "u-b", pendingSignatureCount: 5 }),
      makeRow({
        userId: "u-na",
        ruleId: null,
        evaluation: null,
        pendingSignatureCount: 2,
      }),
    ]);
    expect(m.totalPendingSignatures).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// bottomAtRisk
// ---------------------------------------------------------------------------

describe("bottomAtRisk", () => {
  it("sorts red before yellow and excludes green/unassigned", () => {
    const rows = [
      makeRow({ userId: "g", name: "Green One", evaluation: makeEvaluation("green") }),
      makeRow({ userId: "y", name: "Yellow One", evaluation: makeEvaluation("yellow") }),
      makeRow({ userId: "r", name: "Red One", evaluation: makeEvaluation("red") }),
      makeRow({ userId: "u", name: "Unassigned", ruleId: null, evaluation: null }),
    ];
    const result = bottomAtRisk(rows, 5);
    expect(result.map((r) => r.userId)).toEqual(["r", "y"]);
  });

  it("respects N limit and tie-breaks by lower practice progress first", () => {
    const rows = [
      makeRow({
        userId: "r-50",
        evaluation: makeEvaluation("red", {
          progress: { practiceProgressPct: 50, supervisionProgressPct: 30 },
        }),
      }),
      makeRow({
        userId: "r-10",
        evaluation: makeEvaluation("red", {
          progress: { practiceProgressPct: 10, supervisionProgressPct: 30 },
        }),
      }),
      makeRow({
        userId: "r-30",
        evaluation: makeEvaluation("red", {
          progress: { practiceProgressPct: 30, supervisionProgressPct: 30 },
        }),
      }),
      makeRow({
        userId: "y-5",
        evaluation: makeEvaluation("yellow", {
          progress: { practiceProgressPct: 5, supervisionProgressPct: 30 },
        }),
      }),
      makeRow({
        userId: "g",
        evaluation: makeEvaluation("green"),
      }),
    ];
    const result = bottomAtRisk(rows, 2);
    // Top 2 should be red (sorted by lower practice pct first): r-10, r-30
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.userId)).toEqual(["r-10", "r-30"]);
    // Ensure green is NOT included
    expect(result.find((r) => r.userId === "g")).toBeUndefined();
  });
});
