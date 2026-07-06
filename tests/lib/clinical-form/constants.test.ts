import { describe, it, expect } from "vitest";
import {
  CORE_SKILLS,
  COMPETENCIES,
  SUPERVISION_TYPE_LABELS,
  FREQUENCY_PLAN_LABELS,
} from "@/lib/clinical-form/constants";
import { SUPERVISION_TYPES } from "@/lib/db/schema";

describe("CORE_SKILLS", () => {
  it("has unique keys", () => {
    const keys = CORE_SKILLS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("includes the 'other' catch-all", () => {
    expect(CORE_SKILLS.some((s) => s.key === "other")).toBe(true);
  });

  it("has 7 items matching the RI form", () => {
    expect(CORE_SKILLS.length).toBe(7);
  });
});

describe("COMPETENCIES", () => {
  it("has unique keys", () => {
    const keys = COMPETENCIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has 27 items matching the RI form grid", () => {
    expect(COMPETENCIES.length).toBe(27);
  });

  it("marks required items with required: true", () => {
    const required = COMPETENCIES.filter((c) => c.required);
    expect(required.length).toBeGreaterThan(0);
    expect(required.some((c) => c.key === "technical_knowledge")).toBe(true);
    expect(required.some((c) => c.key === "safety_protocols")).toBe(true);
  });

  it("every item has a non-empty label", () => {
    for (const c of COMPETENCIES) {
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
});

describe("SUPERVISION_TYPE_LABELS", () => {
  it("has a label for every SUPERVISION_TYPES enum value", () => {
    for (const t of SUPERVISION_TYPES) {
      expect(SUPERVISION_TYPE_LABELS[t]).toBeDefined();
      expect(SUPERVISION_TYPE_LABELS[t].length).toBeGreaterThan(0);
    }
  });
});

describe("FREQUENCY_PLAN_LABELS", () => {
  it("covers the expected frequency values", () => {
    const expected = ["weekly", "biweekly", "monthly", "bimonthly", "quarterly", "as_needed"];
    for (const f of expected) {
      expect(FREQUENCY_PLAN_LABELS[f]).toBeDefined();
    }
  });
});
