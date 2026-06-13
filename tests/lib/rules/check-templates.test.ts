import { describe, it, expect } from "vitest";
import {
  TEMPLATE_CATALOG,
  TEMPLATE_DEFAULT_SEVERITY,
  buildRuleCheckFromInstance,
  validateInstance,
  type CheckTemplateInstance,
} from "@/lib/rules/check-templates";
import { CHECK_REGISTRY } from "@/lib/rules/checks";

function inst(
  partial: Partial<CheckTemplateInstance> &
    Pick<CheckTemplateInstance, "templateKey" | "subKind">
): CheckTemplateInstance {
  const subKindDef =
    TEMPLATE_CATALOG[partial.templateKey].subKinds[partial.subKind];
  const params: Record<string, number> = {};
  for (const p of subKindDef.params) params[p.key] = p.default;
  return {
    templateKey: partial.templateKey,
    subKind: partial.subKind,
    severity: TEMPLATE_DEFAULT_SEVERITY[partial.templateKey],
    description: subKindDef.defaultDescription,
    params,
    ...partial,
  };
}

describe("check-templates catalog", () => {
  it("every sub-kind's evaluatorId matches an entry in CHECK_REGISTRY", () => {
    for (const template of Object.values(TEMPLATE_CATALOG)) {
      for (const subKind of Object.values(template.subKinds)) {
        expect(CHECK_REGISTRY[subKind.evaluatorId]).toBeDefined();
      }
    }
  });

  it("exposes exactly seven templates per the strategy doc", () => {
    expect(Object.keys(TEMPLATE_CATALOG)).toHaveLength(7);
  });
});

describe("buildRuleCheckFromInstance", () => {
  it("emits a RuleCheck whose id matches the sub-kind's evaluatorId", () => {
    const check = buildRuleCheckFromInstance(
      inst({ templateKey: "total_hours", subKind: "practice" })
    );
    expect(check.id).toBe("total_practice_hours");
    expect(check.severity).toBe(TEMPLATE_DEFAULT_SEVERITY.total_hours);
    expect(check.params.required).toBeGreaterThan(0);
  });

  it("uses the user-provided description when set", () => {
    const check = buildRuleCheckFromInstance(
      inst({
        templateKey: "total_hours",
        subKind: "supervision",
        description: "Custom description",
      })
    );
    expect(check.description).toBe("Custom description");
  });

  it("falls back to the default description when empty", () => {
    const check = buildRuleCheckFromInstance(
      inst({
        templateKey: "total_hours",
        subKind: "supervision",
        description: "",
      })
    );
    expect(check.description).toBe(
      TEMPLATE_CATALOG.total_hours.subKinds.supervision.defaultDescription
    );
  });

  it("preserves params for cadence/biweekly", () => {
    const check = buildRuleCheckFromInstance(
      inst({
        templateKey: "cadence",
        subKind: "biweekly",
        params: { max_gap_days: 21, min_hours_per_period: 2 },
      })
    );
    expect(check.id).toBe("individual_supervision_cadence");
    expect(check.params.max_gap_days).toBe(21);
    expect(check.params.min_hours_per_period).toBe(2);
  });

  it("throws on an unknown sub-kind", () => {
    expect(() =>
      buildRuleCheckFromInstance({
        templateKey: "total_hours",
        subKind: "not_a_kind",
        severity: "info",
        description: "",
        params: {},
      })
    ).toThrow(/Unknown sub-kind/);
  });
});

describe("validateInstance", () => {
  it("accepts a fully-populated instance from the defaults", () => {
    expect(() =>
      validateInstance(inst({ templateKey: "group_cap", subKind: "default" }))
    ).not.toThrow();
  });

  it("rejects a missing required param", () => {
    expect(() =>
      validateInstance({
        templateKey: "total_hours",
        subKind: "practice",
        severity: "info",
        description: "",
        params: {},
      })
    ).toThrow(/Missing 'required'/);
  });

  it("rejects a param below the catalog's min", () => {
    expect(() =>
      validateInstance({
        templateKey: "group_cap",
        subKind: "default",
        severity: "blocker",
        description: "",
        params: { max_attendees: 1 },
      })
    ).toThrow(/max_attendees.*≥ 2/);
  });

  it("rejects a non-integer where the catalog requires integer", () => {
    expect(() =>
      validateInstance({
        templateKey: "total_hours",
        subKind: "practice",
        severity: "info",
        description: "",
        params: { required: 3000.5 },
      })
    ).toThrow(/integer/);
  });

  it("rejects a fraction outside 0-1 for supervision_ratio/min_share", () => {
    expect(() =>
      validateInstance({
        templateKey: "supervision_ratio",
        subKind: "min_share",
        severity: "warning",
        description: "",
        params: {
          min_individual_fraction: 1.5,
          enforce_after_practice_hours: 0,
        },
      })
    ).toThrow(/≤ 1/);
  });
});
