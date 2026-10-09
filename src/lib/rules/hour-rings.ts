import type { EvaluationTotals, RuleStructured } from "./types";

/**
 * Pure ring/legend math for the supervisee "Licensure progress" multi-ring
 * (see docs/App changes/handoff-05-supervisee-page.md §3).
 *
 * Rings derive strictly from real rule fields. Where a rule provides no honest
 * denominator (group hours; individual supervision when the rule omits
 * `min_individual_supervision_fraction`) we degrade to an hours-only legend
 * stat rather than fabricating a target.
 */

export type HourRing = {
  key: "practice" | "supervision" | "individual";
  label: string;
  value: number;
  max: number;
  /** 0..1, clamped — drives the SVG arc sweep. */
  fraction: number;
  /** Rounded integer percentage — the label. */
  pct: number;
  met: boolean;
};

export type HourLegendStat = {
  key: "individual" | "group";
  label: string;
  value: number;
  /** null when the rule provides no honest total-hours target. */
  max: number | null;
  met: boolean;
};

export type HourRingModel = {
  rings: HourRing[];
  stats: HourLegendStat[];
};

/** value/max clamped to [0, 1]; 0 when max is missing or non-positive. */
export function clampFraction(value: number, max: number): number {
  if (!(max > 0)) return 0;
  const f = value / max;
  if (!Number.isFinite(f) || f < 0) return 0;
  return Math.min(1, f);
}

/**
 * Individual-supervision hour target, derived from the optional fraction.
 * Returns null when the rule doesn't define `min_individual_supervision_fraction`
 * — there is no absolute individual target in that case, so callers must NOT
 * invent a denominator.
 */
export function individualRequired(
  structured: Pick<
    RuleStructured,
    "total_supervision_hours_required" | "min_individual_supervision_fraction"
  >
): number | null {
  const f = structured.min_individual_supervision_fraction;
  if (f === undefined || f === null) return null;
  return structured.total_supervision_hours_required * f;
}

function ring(
  key: HourRing["key"],
  label: string,
  value: number,
  max: number
): HourRing {
  const fraction = clampFraction(value, max);
  return {
    key,
    label,
    value,
    max,
    fraction,
    pct: Math.round(fraction * 100),
    met: max > 0 && value >= max,
  };
}

export function computeHourRings(
  totals: EvaluationTotals,
  structured: RuleStructured
): HourRingModel {
  const rings: HourRing[] = [
    ring(
      "practice",
      "Total supervised",
      totals.practiceHours,
      structured.total_practice_hours_required
    ),
    ring(
      "supervision",
      "Supervision",
      totals.supervisionHours,
      structured.total_supervision_hours_required
    ),
  ];

  const stats: HourLegendStat[] = [];

  const indMax = individualRequired(structured);
  if (indMax != null && indMax > 0) {
    rings.push(
      ring(
        "individual",
        "Individual",
        totals.individualSupervisionHours,
        indMax
      )
    );
  } else {
    // No honest denominator — hours-only legend stat.
    stats.push({
      key: "individual",
      label: "Individual",
      value: totals.individualSupervisionHours,
      max: null,
      met: false,
    });
  }

  // Group has only a per-session size cap, never a total-hours target.
  stats.push({
    key: "group",
    label: "Group",
    value: totals.groupSupervisionHours,
    max: null,
    met: false,
  });

  return { rings, stats };
}
