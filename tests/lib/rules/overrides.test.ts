import { describe, it, expect } from "vitest";
import {
  buildCustomRule,
  customRuleId,
  isCustomRuleId,
  mergeOverride,
  orgIdFromCustomRuleId,
  type OverrideRow,
} from "@/lib/rules/overrides";
import { getRule } from "@/lib/rules/loader";

function emptyOverrideRow(partial: Partial<OverrideRow> = {}): OverrideRow {
  return {
    canonicalRuleId: "nc-lcmhca-v1",
    jurisdiction: "NC",
    licenseCode: "LCMHCA",
    version: 1,
    label: "Test override",
    structuredPatch: {},
    checksPatch: {},
    customMetadata: null,
    ...partial,
  };
}

describe("customRuleId", () => {
  it("formats the synthetic id with the org scope", () => {
    const id = customRuleId(
      "11111111-1111-1111-1111-111111111111",
      emptyOverrideRow({
        canonicalRuleId: null,
        jurisdiction: "WY",
        licenseCode: "LPCA",
        version: 1,
      })
    );
    expect(id).toBe(
      "org:11111111-1111-1111-1111-111111111111:custom:wy-lpca-v1"
    );
  });

  it("round-trips through isCustomRuleId + orgIdFromCustomRuleId", () => {
    const id = customRuleId("org-abc", emptyOverrideRow({ jurisdiction: "WY", licenseCode: "LPCA" }));
    expect(isCustomRuleId(id)).toBe(true);
    expect(orgIdFromCustomRuleId(id)).toBe("org-abc");
  });

  it("rejects canonical ids as custom", () => {
    expect(isCustomRuleId("nc-lcmhca-v1")).toBe(false);
    expect(orgIdFromCustomRuleId("nc-lcmhca-v1")).toBeNull();
  });
});

describe("mergeOverride", () => {
  it("passes the canonical through unchanged when patches are empty", () => {
    const canonical = getRule("NC", "LCMHCA", 1);
    const merged = mergeOverride(canonical, emptyOverrideRow());
    expect(merged.structured).toEqual(canonical.structured);
    expect(merged.checks).toEqual(canonical.checks);
  });

  it("replaces a structured field via structured_patch", () => {
    const canonical = getRule("NC", "LCMHCA", 1);
    const tighter = canonical.structured.total_supervision_hours_required + 50;
    const merged = mergeOverride(
      canonical,
      emptyOverrideRow({
        structuredPatch: { total_supervision_hours_required: tighter },
      })
    );
    expect(merged.structured.total_supervision_hours_required).toBe(tighter);
    expect(merged.structured.total_practice_hours_required).toBe(
      canonical.structured.total_practice_hours_required
    );
  });

  it("drops checks listed in checks_patch.remove", () => {
    const canonical = getRule("NC", "LCMHCA", 1);
    const merged = mergeOverride(
      canonical,
      emptyOverrideRow({
        checksPatch: { remove: ["group_size_limit"] },
      })
    );
    expect(merged.checks.some((c) => c.id === "group_size_limit")).toBe(false);
    expect(merged.checks.length).toBe(canonical.checks.length - 1);
  });

  // Regression for the 2026-06-12 user-visible bug: tightening a structured
  // field was visible on the rules dashboard but the supervisee compliance
  // still showed the canonical value because the matching check reads its
  // own params, not rule.structured. mergeOverride must propagate.
  it("propagates total_practice_hours_required to the total_practice_hours check param", () => {
    const canonical = getRule("NC", "LCMHCA", 1);
    const tighter = canonical.structured.total_practice_hours_required + 1;
    const merged = mergeOverride(
      canonical,
      emptyOverrideRow({
        structuredPatch: { total_practice_hours_required: tighter },
      })
    );
    const check = merged.checks.find((c) => c.id === "total_practice_hours");
    expect(check).toBeDefined();
    expect(check!.params.required).toBe(tighter);
  });

  it("propagates max_duration_months to the duration_window check param", () => {
    const canonical = getRule("NC", "LCMHCA", 1);
    const merged = mergeOverride(
      canonical,
      emptyOverrideRow({
        structuredPatch: { max_duration_months: 48 },
      })
    );
    const check = merged.checks.find((c) => c.id === "duration_window");
    if (check) {
      expect(check.params.max_months).toBe(48);
    }
  });

  it("explicit replace_params win over structured propagation", () => {
    const canonical = getRule("NC", "LCMHCA", 1);
    const merged = mergeOverride(
      canonical,
      emptyOverrideRow({
        structuredPatch: { total_practice_hours_required: 3001 },
        checksPatch: {
          replace_params: { total_practice_hours: { required: 9999 } },
        },
      })
    );
    const check = merged.checks.find((c) => c.id === "total_practice_hours");
    expect(check!.params.required).toBe(9999);
  });

  it("merges params via checks_patch.replace_params", () => {
    const canonical = getRule("NC", "LCMHCA", 1);
    const before = canonical.checks.find((c) => c.id === "group_size_limit");
    expect(before).toBeDefined();
    const merged = mergeOverride(
      canonical,
      emptyOverrideRow({
        checksPatch: {
          replace_params: { group_size_limit: { max_attendees: 4 } },
        },
      })
    );
    const after = merged.checks.find((c) => c.id === "group_size_limit");
    expect(after?.params.max_attendees).toBe(4);
  });

  it("appends new checks via checks_patch.add", () => {
    const canonical = getRule("NC", "LCMHCA", 1);
    const merged = mergeOverride(
      canonical,
      emptyOverrideRow({
        checksPatch: {
          add: [
            {
              id: "custom_internal_policy",
              severity: "warning",
              description: "Internal policy: practice must include a peer note.",
              params: { tag: "internal" },
            },
          ],
        },
      })
    );
    const added = merged.checks.find((c) => c.id === "custom_internal_policy");
    expect(added).toBeDefined();
    expect(added?.severity).toBe("warning");
  });

  it("downgrades severity via checks_patch.replace_severity", () => {
    const canonical = getRule("NC", "LCMHCA", 1);
    const merged = mergeOverride(
      canonical,
      emptyOverrideRow({
        checksPatch: {
          replace_severity: { group_size_limit: "warning" },
        },
      })
    );
    const after = merged.checks.find((c) => c.id === "group_size_limit");
    expect(after?.severity).toBe("warning");
  });

  it("throws when the merge produces an invalid Rule", () => {
    const canonical = getRule("NC", "LCMHCA", 1);
    expect(() =>
      mergeOverride(
        canonical,
        emptyOverrideRow({
          // structured.total_supervision_hours_required is z.number().positive()
          structuredPatch: { total_supervision_hours_required: 0 },
        })
      )
    ).toThrow();
  });
});

describe("buildCustomRule", () => {
  const baseRow: OverrideRow = {
    canonicalRuleId: null,
    jurisdiction: "WY",
    licenseCode: "LPCA",
    version: 1,
    label: "Wyoming LPC Associate (internal draft)",
    structuredPatch: {
      total_practice_hours_required: 3000,
      total_supervision_hours_required: 100,
      group_max_attendees: 6,
    },
    checksPatch: {
      checks: [
        {
          id: "custom_total_practice_hours",
          severity: "info",
          description: "3000 supervised practice hours",
          params: { required: 3000 },
        },
        {
          id: "custom_group_cap",
          severity: "blocker",
          description: "Group supervision capped at 6 supervisees",
          params: { max_attendees: 6 },
        },
      ],
    },
    customMetadata: {
      license_name: "Licensed Professional Counselor Associate",
      issuing_board: "Wyoming Mental Health Professions Licensing Board",
      summary: "Org-drafted rule pending canonical YAML.",
      citation: {
        admincode: "Wyo. Admin. Code Ch. 1",
        url: "https://example.com/wy-source",
      },
      verification: {
        last_verified_at: "2026-06-12",
        last_verified_by: "Caleb (org HR Admin)",
      },
    },
  };

  it("builds a Rule with the org-supplied metadata + structured + checks", () => {
    const rule = buildCustomRule("org-abc", baseRow);
    expect(rule.jurisdiction).toBe("WY");
    expect(rule.license_code).toBe("LPCA");
    expect(rule.version).toBe(1);
    expect(rule.structured.total_practice_hours_required).toBe(3000);
    expect(rule.structured.group_max_attendees).toBe(6);
    expect(rule.checks.length).toBe(2);
    expect(rule.citation.url).toBe("https://example.com/wy-source");
    expect(rule.verification.source_hash).toBe("org:org-abc:self-attested");
  });

  it("throws when the row is actually an override (canonicalRuleId set)", () => {
    expect(() =>
      buildCustomRule("org-abc", { ...baseRow, canonicalRuleId: "nc-lcmhca-v1" })
    ).toThrow();
  });

  it("throws when custom_metadata is missing", () => {
    expect(() =>
      buildCustomRule("org-abc", { ...baseRow, customMetadata: null })
    ).toThrow();
  });
});
