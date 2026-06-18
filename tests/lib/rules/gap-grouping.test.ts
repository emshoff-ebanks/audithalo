import { describe, it, expect } from "vitest";
import { groupGaps } from "@/lib/rules/gap-grouping";
import type { Gap } from "@/lib/rules/types";

function cadenceGap(opts: { from: string; to: string; days: number }): Gap {
  return {
    code: "individual_supervision_cadence",
    severity: "warning",
    message: `Individual supervision gap of ${opts.days} days exceeds the 14-day maximum.`,
    detail: { from: opts.from, to: opts.to },
    action: {
      kind: "recurring_behavior",
      actionLabel: "Log individual supervision",
      targetSessionType: "individual",
    },
  };
}

function attestationGap(checkId: string): Gap {
  return {
    code: checkId,
    severity: "blocker",
    message: "Missing attestation",
    action: {
      kind: "attestation",
      checkId,
      signalField: "supervisionContractFiledAt",
      actionLabel: "Attest",
      valueShape: "date",
    },
  };
}

describe("groupGaps", () => {
  it("returns empty for empty input", () => {
    expect(groupGaps([])).toEqual([]);
  });

  it("preserves a single gap as a one-element group", () => {
    const g = cadenceGap({ from: "2026-01-01", to: "2026-02-01", days: 31 });
    const result = groupGaps([g]);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("individual_supervision_cadence");
    expect(result[0].gaps).toEqual([g]);
    expect(result[0].representative).toBe(g);
  });

  it("collapses multiple same-code gaps into one group (the Caleb 13x case)", () => {
    const gaps: Gap[] = [
      cadenceGap({ from: "2026-01-01", to: "2026-02-01", days: 31 }),
      cadenceGap({ from: "2026-02-08", to: "2026-03-10", days: 30 }),
      cadenceGap({ from: "2026-03-12", to: "2026-04-13", days: 32 }),
    ];
    const result = groupGaps(gaps);
    expect(result).toHaveLength(1);
    expect(result[0].gaps).toHaveLength(3);
  });

  it("picks the largest window as the representative", () => {
    const small = cadenceGap({ from: "2026-01-01", to: "2026-02-01", days: 31 });
    const huge = cadenceGap({ from: "2026-02-08", to: "2026-03-30", days: 50 });
    const medium = cadenceGap({ from: "2026-04-01", to: "2026-05-04", days: 33 });
    const result = groupGaps([small, huge, medium]);
    expect(result[0].representative).toBe(huge);
  });

  it("keeps separate codes in distinct groups, preserving first-seen order", () => {
    const cadence = cadenceGap({ from: "2026-01-01", to: "2026-02-01", days: 31 });
    const contract = attestationGap("supervision_contract_filed");
    const result = groupGaps([cadence, contract]);
    expect(result.map((g) => g.code)).toEqual([
      "individual_supervision_cadence",
      "supervision_contract_filed",
    ]);
  });

  it("groups attestation gaps the same as any other code (deliberate — engine only emits one per check anyway)", () => {
    // Two attestation gaps with the same code would be a rule-engine bug
    // upstream, but the grouper is structural: same code, one group.
    const a = attestationGap("supervision_contract_filed");
    const b = attestationGap("supervision_contract_filed");
    expect(groupGaps([a, b])[0].gaps).toHaveLength(2);
  });

  it("falls back to last gap as representative when none have from/to detail", () => {
    const g1: Gap = {
      code: "x",
      severity: "info",
      message: "first",
      action: { kind: "data_accumulation", progressTowards: { logged: 1, required: 10, unit: "hrs" } },
    };
    const g2: Gap = { ...g1, message: "second" };
    expect(groupGaps([g1, g2])[0].representative).toBe(g1);
  });
});
