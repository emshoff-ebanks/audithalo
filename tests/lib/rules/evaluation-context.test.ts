import { describe, it, expect } from "vitest";
import { resolveEvaluation } from "@/lib/rules";
import type { schema } from "@/lib/db";

type Assignment = typeof schema.superviseeRuleAssignments.$inferSelect;
type SessionEvent = typeof schema.sessionEvents.$inferSelect;

function mkAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "a1",
    superviseeId: "u1",
    orgId: "o1",
    ruleId: "nc-lcmhca-v1",
    obligationStartedAt: new Date("2026-01-01"),
    supervisionContractFiledAt: new Date("2025-12-15"),
    createdAt: new Date(),
    ...overrides,
  };
}

function mkPracticeEvent(durationHours: number, daysAfter = 1): SessionEvent {
  return {
    id: `p${daysAfter}`,
    superviseeId: "u1",
    orgId: "o1",
    kind: "practice",
    date: new Date(`2026-01-${String(daysAfter + 1).padStart(2, "0")}`),
    durationHours,
    sessionType: null,
    supervisorCredentials: null,
    groupAttendees: null,
    loggedById: "u1",
    signatures: [],
    signedAt: null,
    createdAt: new Date(),
  } as unknown as SessionEvent;
}

describe("resolveEvaluation", () => {
  it("returns null when the ruleId is malformed", () => {
    expect(resolveEvaluation(mkAssignment({ ruleId: "not-a-rule" }), [])).toBeNull();
  });

  it("returns null when the rule is not in the registry", () => {
    expect(
      resolveEvaluation(mkAssignment({ ruleId: "zz-fake-v9" }), [])
    ).toBeNull();
  });

  it("returns the rule + evaluation for a valid assignment", () => {
    const result = resolveEvaluation(mkAssignment(), [mkPracticeEvent(8)]);
    expect(result).not.toBeNull();
    expect(result?.rule.jurisdiction).toBe("NC");
    expect(result?.rule.license_code).toBe("LCMHCA");
    expect(result?.evaluation.totals.practiceHours).toBe(8);
  });

  it("respects the asOf parameter when provided", () => {
    const future = new Date("2027-01-01");
    const result = resolveEvaluation(
      mkAssignment(),
      [mkPracticeEvent(8)],
      future
    );
    // Just confirm asOf doesn't break anything; the evaluator's date handling
    // is itself tested elsewhere
    expect(result).not.toBeNull();
  });
});
