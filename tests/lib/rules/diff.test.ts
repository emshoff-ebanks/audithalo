import { describe, it, expect } from "vitest";
import { summarizeOverrideDiff } from "@/lib/rules/diff";
import { getRule } from "@/lib/rules/loader";

describe("summarizeOverrideDiff", () => {
  const canonical = getRule("NC", "LCMHCA", 1);

  it("returns isNoOp on empty patch", () => {
    const diff = summarizeOverrideDiff(canonical, {
      structuredPatch: {},
      checksPatch: {},
    });
    expect(diff.isNoOp).toBe(true);
    expect(diff.structured).toEqual([]);
    expect(diff.checks).toEqual([]);
  });

  it("flags a higher supervision-hour requirement as tighter", () => {
    const tighter =
      canonical.structured.total_supervision_hours_required + 50;
    const diff = summarizeOverrideDiff(canonical, {
      structuredPatch: { total_supervision_hours_required: tighter },
      checksPatch: {},
    });
    expect(diff.isNoOp).toBe(false);
    expect(diff.structured).toHaveLength(1);
    expect(diff.structured[0]).toMatchObject({
      overrideValue: tighter,
      direction: "tighter",
    });
  });

  it("flags a lower max-duration-months as tighter", () => {
    const original = canonical.structured.max_duration_months ?? 60;
    const diff = summarizeOverrideDiff(canonical, {
      structuredPatch: { max_duration_months: original - 12 },
      checksPatch: {},
    });
    expect(diff.structured[0].direction).toBe("tighter");
  });

  it("flags a lower supervision-hour requirement as looser", () => {
    const looser =
      canonical.structured.total_supervision_hours_required - 10;
    const diff = summarizeOverrideDiff(canonical, {
      structuredPatch: { total_supervision_hours_required: looser },
      checksPatch: {},
    });
    expect(diff.structured[0].direction).toBe("looser");
  });

  it("skips structured fields whose patch value equals canonical (no-op)", () => {
    const diff = summarizeOverrideDiff(canonical, {
      structuredPatch: {
        total_supervision_hours_required:
          canonical.structured.total_supervision_hours_required,
      },
      checksPatch: {},
    });
    expect(diff.isNoOp).toBe(true);
  });

  it("emits severity_changed rows for a downgrade", () => {
    const blocker = canonical.checks.find((c) => c.severity === "blocker");
    expect(blocker, "fixture: NC LCMHCA v1 has a blocker check").toBeDefined();
    const diff = summarizeOverrideDiff(canonical, {
      structuredPatch: {},
      checksPatch: { replace_severity: { [blocker!.id]: "warning" } },
    });
    expect(diff.checks).toHaveLength(1);
    expect(diff.checks[0]).toMatchObject({
      kind: "severity_changed",
      checkId: blocker!.id,
      canonicalSeverity: "blocker",
      overrideSeverity: "warning",
    });
  });

  it("ignores severity changes that don't actually downgrade", () => {
    const warning = canonical.checks.find((c) => c.severity === "warning");
    expect(warning).toBeDefined();
    // No-op (warning → warning) AND upgrade (warning → blocker) are both
    // excluded from the diff.
    const diff = summarizeOverrideDiff(canonical, {
      structuredPatch: {},
      checksPatch: {
        replace_severity: {
          [warning!.id]: "blocker",
          another_id_we_invented: "warning",
        },
      },
    });
    expect(diff.checks).toHaveLength(0);
  });

  it("emits removed rows", () => {
    const target = canonical.checks[0];
    const diff = summarizeOverrideDiff(canonical, {
      structuredPatch: {},
      checksPatch: { remove: [target.id, "not_a_real_check"] },
    });
    expect(diff.checks).toHaveLength(1);
    expect(diff.checks[0]).toMatchObject({
      kind: "removed",
      checkId: target.id,
    });
  });
});
