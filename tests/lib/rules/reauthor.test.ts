import { describe, it, expect } from "vitest";
import {
  buildReauthorPrefill,
  isCompatibleReauthorSource,
  type ReauthorSource,
} from "@/lib/rules/reauthor";
import { getRule } from "@/lib/rules/loader";

function baseSource(
  partial: Partial<ReauthorSource> = {}
): ReauthorSource {
  return {
    canonicalRuleId: "nc-lcmhca-v1",
    jurisdiction: "NC",
    licenseCode: "LCMHCA",
    label: "NC LCMHCA v1 — internal override",
    structuredPatch: {},
    checksPatch: {},
    ...partial,
  };
}

describe("isCompatibleReauthorSource", () => {
  const ncV1 = getRule("NC", "LCMHCA", 1);

  it("accepts a source on the same (jurisdiction, license) as the destination", () => {
    expect(isCompatibleReauthorSource(ncV1, baseSource())).toBe(true);
  });

  it("rejects a custom rule source", () => {
    expect(
      isCompatibleReauthorSource(
        ncV1,
        baseSource({ canonicalRuleId: null })
      )
    ).toBe(false);
  });

  it("rejects a source from a different state", () => {
    expect(
      isCompatibleReauthorSource(
        ncV1,
        baseSource({ jurisdiction: "FL", licenseCode: "RMHCI" })
      )
    ).toBe(false);
  });

  it("is case-insensitive on jurisdiction + license", () => {
    expect(
      isCompatibleReauthorSource(
        ncV1,
        baseSource({ jurisdiction: "nc", licenseCode: "lcmhca" })
      )
    ).toBe(true);
  });
});

describe("buildReauthorPrefill", () => {
  const ncV1 = getRule("NC", "LCMHCA", 1);

  it("carries the structured patch through unchanged", () => {
    const prefill = buildReauthorPrefill(
      ncV1,
      baseSource({
        structuredPatch: { total_supervision_hours_required: 150 },
      })
    );
    expect(prefill.structuredPatch.total_supervision_hours_required).toBe(150);
  });

  it("carries the source label through unchanged", () => {
    const prefill = buildReauthorPrefill(
      ncV1,
      baseSource({ label: "Our policy" })
    );
    expect(prefill.label).toBe("Our policy");
  });

  it("filters severity changes to check ids that still exist on destination", () => {
    const existingId = ncV1.checks[0].id;
    const prefill = buildReauthorPrefill(
      ncV1,
      baseSource({
        checksPatch: {
          replace_severity: {
            [existingId]: "warning",
            ghost_check_from_v1: "info",
          },
        },
      })
    );
    expect(prefill.severityChanges).toEqual({ [existingId]: "warning" });
  });

  it("filters removeChecks to check ids that still exist on destination", () => {
    const existingId = ncV1.checks[0].id;
    const prefill = buildReauthorPrefill(
      ncV1,
      baseSource({
        checksPatch: {
          remove: [existingId, "ghost_check_from_v1"],
        },
      })
    );
    expect(prefill.removeChecks).toEqual([existingId]);
  });

  it("returns empty maps when the source has no check patches", () => {
    const prefill = buildReauthorPrefill(ncV1, baseSource());
    expect(prefill.severityChanges).toEqual({});
    expect(prefill.removeChecks).toEqual([]);
  });
});
