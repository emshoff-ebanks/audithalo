import { describe, it, expect } from "vitest";
import {
  clampFraction,
  individualRequired,
  computeHourRings,
} from "@/lib/rules/hour-rings";
import type { EvaluationTotals } from "@/lib/rules/types";

const totals: EvaluationTotals = {
  practiceHours: 1314,
  supervisionHours: 88,
  individualSupervisionHours: 66,
  triadicSupervisionHours: 4,
  groupSupervisionHours: 50,
};

// Rule WITH an individual fraction (0.5 of supervision).
const structuredWithFraction = {
  total_practice_hours_required: 1800,
  total_supervision_hours_required: 100,
  min_individual_supervision_fraction: 0.5,
} as const;

// Rule WITHOUT an individual fraction — the degrade path.
const structuredNoFraction = {
  total_practice_hours_required: 1800,
  total_supervision_hours_required: 100,
} as const;

describe("clampFraction", () => {
  it("returns the ratio in range", () => {
    expect(clampFraction(50, 100)).toBe(0.5);
  });
  it("clamps above 1", () => {
    expect(clampFraction(120, 100)).toBe(1);
  });
  it("returns 0 for missing / non-positive / non-finite denominators", () => {
    expect(clampFraction(50, 0)).toBe(0);
    expect(clampFraction(50, -10)).toBe(0);
    expect(clampFraction(50, Number.NaN)).toBe(0);
  });
  it("floors negatives to 0", () => {
    expect(clampFraction(-5, 100)).toBe(0);
  });
});

describe("individualRequired", () => {
  it("derives the target from the fraction when defined", () => {
    expect(individualRequired(structuredWithFraction)).toBe(50);
  });
  it("returns null when the fraction is undefined (no honest denominator)", () => {
    expect(individualRequired(structuredNoFraction)).toBeNull();
  });
});

describe("computeHourRings", () => {
  it("builds three rings when the individual fraction is defined", () => {
    const { rings, stats } = computeHourRings(totals, structuredWithFraction);
    expect(rings.map((r) => r.key)).toEqual([
      "practice",
      "supervision",
      "individual",
    ]);

    const practice = rings[0];
    expect(practice.value).toBe(1314);
    expect(practice.max).toBe(1800);
    expect(practice.pct).toBe(73); // round(1314/1800*100)
    expect(practice.met).toBe(false);

    const individual = rings[2];
    expect(individual.max).toBe(50); // 100 * 0.5
    expect(individual.value).toBe(66);
    expect(individual.fraction).toBe(1); // clamped (66 >= 50)
    expect(individual.met).toBe(true);

    // Only group remains as an hours-only stat.
    expect(stats.map((s) => s.key)).toEqual(["group"]);
    expect(stats[0].max).toBeNull();
    expect(stats[0].value).toBe(50);
  });

  it("degrades the individual ring to an hours-only stat when the fraction is missing", () => {
    const { rings, stats } = computeHourRings(totals, structuredNoFraction);
    // No individual ring — no fabricated denominator.
    expect(rings.map((r) => r.key)).toEqual(["practice", "supervision"]);
    expect(rings.every((r) => r.max > 0)).toBe(true);

    // Individual falls back to a legend stat with no max, alongside group.
    expect(stats.map((s) => s.key)).toEqual(["individual", "group"]);
    const individual = stats.find((s) => s.key === "individual")!;
    expect(individual.max).toBeNull();
    expect(individual.value).toBe(66);
    expect(individual.met).toBe(false);
  });

  it("marks a ring met and clamps the fraction when the target is reached", () => {
    const done: EvaluationTotals = { ...totals, supervisionHours: 100 };
    const { rings } = computeHourRings(done, structuredWithFraction);
    const supervision = rings.find((r) => r.key === "supervision")!;
    expect(supervision.met).toBe(true);
    expect(supervision.pct).toBe(100);
    expect(supervision.fraction).toBe(1);
  });
});
