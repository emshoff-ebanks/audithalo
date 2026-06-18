/**
 * Group rule-engine Gaps by their `code` (check id) so the renderer can
 * collapse same-kind repeats into a single summary card.
 *
 * The cadence check (`individual_supervision_cadence`) emits one Gap per
 * offending window; a 6-month period with weekly violations stacks 13+
 * visually identical cards. Grouping keeps the action label and severity
 * but folds the N message details into an expand-to-reveal block.
 *
 * `attestation` gaps are never grouped — each one drives its own form,
 * and in practice the engine only ever emits one attestation per check.
 * Grouping is therefore safe across all action kinds; we only collapse
 * when there are 2+ gaps under the same code.
 */

import type { Gap } from "./types";

export type GapGroup = {
  /** The check id all gaps share (same as gap.code). */
  code: string;
  /** Representative gap used for severity, action, and the headline message. */
  representative: Gap;
  /** All gaps in the group, in their original order from the evaluator. */
  gaps: Gap[];
};

export function groupGaps(gaps: Gap[]): GapGroup[] {
  const byCode = new Map<string, Gap[]>();
  const order: string[] = [];

  for (const g of gaps) {
    if (!byCode.has(g.code)) {
      byCode.set(g.code, []);
      order.push(g.code);
    }
    byCode.get(g.code)!.push(g);
  }

  return order.map((code) => {
    const group = byCode.get(code)!;
    return {
      code,
      representative: pickRepresentative(group),
      gaps: group,
    };
  });
}

/**
 * Pick the representative Gap for a group. For cadence (and other
 * data_correction kinds with from/to in detail), prefer the largest
 * window — that's the "longest gap" the user most wants to know about.
 * Falls back to the last gap (most recent in time series).
 */
function pickRepresentative(group: Gap[]): Gap {
  if (group.length === 1) return group[0];

  let best = group[0];
  let bestDays = gapDays(best);
  for (let i = 1; i < group.length; i++) {
    const days = gapDays(group[i]);
    if (days > bestDays) {
      best = group[i];
      bestDays = days;
    }
  }
  return best;
}

/**
 * Extract a "size" for the gap when it has from/to dates in detail.
 * Returns -1 when no date pair is present, so any dated gap beats an
 * undated one in the representative pick.
 */
function gapDays(gap: Gap): number {
  const from = gap.detail?.from;
  const to = gap.detail?.to;
  if (typeof from !== "string" || typeof to !== "string") return -1;
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return -1;
  return (toMs - fromMs) / (1000 * 60 * 60 * 24);
}
