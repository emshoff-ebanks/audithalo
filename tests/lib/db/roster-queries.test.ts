import { describe, it, expect } from "vitest";
import { computeRosterCompliance } from "@/lib/db/roster-queries";
import { getRule } from "@/lib/rules/loader";
import type { EvaluationResult } from "@/lib/rules/types";

// Helper to build a minimal RawEntry
function makeEntry(overrides: Partial<Parameters<typeof computeRosterCompliance>[0][0]> = {}): Parameters<typeof computeRosterCompliance>[0][0] {
  return {
    userId: "user-1",
    name: "Test User",
    email: "test@example.com",
    state: "NC",
    licenseType: "LCMHCA",
    ruleId: null,
    obligationStartedAt: null,
    supervisionContractFiledAt: null,
    rawEvents: [],
    ...overrides,
  };
}

describe("computeRosterCompliance", () => {
  it("returns evaluation: null and pendingSignatureCount: 0 when no rule assigned", () => {
    const entries = [makeEntry({ ruleId: null, obligationStartedAt: null })];
    const rows = computeRosterCompliance(entries);
    expect(rows).toHaveLength(1);
    expect(rows[0].evaluation).toBeNull();
    expect(rows[0].pendingSignatureCount).toBe(0);
  });

  it("returns evaluation: null when ruleId present but no obligationStartedAt", () => {
    const entries = [makeEntry({ ruleId: "nc-lcmhca-v1", obligationStartedAt: null })];
    const rows = computeRosterCompliance(entries);
    expect(rows[0].evaluation).toBeNull();
  });

  it("returns a valid EvaluationResult when rule assigned and events exist", () => {
    const obligationStart = new Date("2026-01-01T00:00:00Z");
    const rawEvents = [
      // practice sessions
      {
        id: "evt-1",
        superviseeId: "user-1",
        orgId: "org-1",
        kind: "practice" as const,
        date: new Date("2026-01-02T00:00:00Z"),
        durationHours: 8,
        sessionType: null,
        supervisorCredentials: null,
        groupAttendees: null,
        loggedById: "user-1",
        signatures: [],
        signedAt: new Date("2026-01-02T12:00:00Z"),
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      // supervision session (signed)
      {
        id: "evt-2",
        superviseeId: "user-1",
        orgId: "org-1",
        kind: "supervision" as const,
        date: new Date("2026-01-05T00:00:00Z"),
        durationHours: 1,
        sessionType: "individual",
        supervisorCredentials: ["LCMHCS"],
        groupAttendees: null,
        loggedById: "supervisor-1",
        signatures: [],
        signedAt: new Date("2026-01-05T14:00:00Z"),
        createdAt: new Date("2026-01-05T00:00:00Z"),
      },
    ];

    const entries = [
      makeEntry({
        userId: "user-1",
        ruleId: "nc-lcmhca-v1",
        obligationStartedAt: obligationStart,
        supervisionContractFiledAt: new Date("2025-12-15T00:00:00Z"),
        rawEvents,
      }),
    ];

    const rows = computeRosterCompliance(entries);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.evaluation).not.toBeNull();
    const evaluation = row.evaluation as EvaluationResult;
    expect(evaluation.ruleId).toBe("nc-lcmhca-v1");
    expect(evaluation.totals.practiceHours).toBe(8);
    expect(evaluation.totals.supervisionHours).toBe(1);
  });

  it("counts pending signatures correctly — null signedAt counts, non-null does not", () => {
    const obligationStart = new Date("2026-01-01T00:00:00Z");
    const rawEvents = [
      {
        id: "evt-pending-1",
        superviseeId: "user-1",
        orgId: "org-1",
        kind: "supervision" as const,
        date: new Date("2026-01-05T00:00:00Z"),
        durationHours: 1,
        sessionType: "individual",
        supervisorCredentials: ["LCMHCS"],
        groupAttendees: null,
        loggedById: "supervisor-1",
        signatures: [],
        signedAt: null, // PENDING — should count
        createdAt: new Date("2026-01-05T00:00:00Z"),
      },
      {
        id: "evt-pending-2",
        superviseeId: "user-1",
        orgId: "org-1",
        kind: "supervision" as const,
        date: new Date("2026-01-12T00:00:00Z"),
        durationHours: 1,
        sessionType: "individual",
        supervisorCredentials: ["LCMHCS"],
        groupAttendees: null,
        loggedById: "supervisor-1",
        signatures: [],
        signedAt: null, // PENDING — should count
        createdAt: new Date("2026-01-12T00:00:00Z"),
      },
      {
        id: "evt-signed",
        superviseeId: "user-1",
        orgId: "org-1",
        kind: "supervision" as const,
        date: new Date("2026-01-19T00:00:00Z"),
        durationHours: 1,
        sessionType: "individual",
        supervisorCredentials: ["LCMHCS"],
        groupAttendees: null,
        loggedById: "supervisor-1",
        signatures: [],
        signedAt: new Date("2026-01-19T14:00:00Z"), // SIGNED — should NOT count
        createdAt: new Date("2026-01-19T00:00:00Z"),
      },
    ];

    const entries = [
      makeEntry({
        ruleId: "nc-lcmhca-v1",
        obligationStartedAt: obligationStart,
        rawEvents,
      }),
    ];

    const rows = computeRosterCompliance(entries);
    expect(rows[0].pendingSignatureCount).toBe(2);
  });

  it("does not count sealed (signed) sessions as pending", () => {
    const rawEvents = [
      {
        id: "evt-sealed",
        superviseeId: "user-1",
        orgId: "org-1",
        kind: "supervision" as const,
        date: new Date("2026-01-05T00:00:00Z"),
        durationHours: 1,
        sessionType: "individual",
        supervisorCredentials: ["LCMHCS"],
        groupAttendees: null,
        loggedById: "supervisor-1",
        signatures: [],
        signedAt: new Date("2026-01-05T14:00:00Z"), // fully signed/sealed
        createdAt: new Date("2026-01-05T00:00:00Z"),
      },
    ];

    const entries = [
      makeEntry({
        ruleId: null, // no rule — so evaluation is null, but pending count still works
        obligationStartedAt: null,
        rawEvents,
      }),
    ];

    const rows = computeRosterCompliance(entries);
    expect(rows[0].pendingSignatureCount).toBe(0);
  });

  // Regression: org overrides on a canonical rule must reach the roster
  // evaluator. Without this, tightening total_practice_hours_required from
  // 3000 → 3001 was visible on the rules dashboard but never affected the
  // supervisee compliance number — the "3000 required" stuck even after
  // the override saved.
  it("applies org overrides on top of canonical when supplied", () => {
    const canonical = getRule("NC", "LCMHCA", 1);
    const tighter = canonical.structured.total_practice_hours_required + 1;

    const entries = [
      makeEntry({
        ruleId: "nc-lcmhca-v1",
        obligationStartedAt: new Date("2026-01-01T00:00:00Z"),
        supervisionContractFiledAt: new Date("2025-12-15T00:00:00Z"),
        rawEvents: [],
      }),
    ];

    const baseline = computeRosterCompliance(entries);
    const overridden = computeRosterCompliance(entries, {
      overridesByCanonical: new Map([
        [
          "nc-lcmhca-v1",
          {
            structuredPatch: { total_practice_hours_required: tighter },
            checksPatch: {},
          },
        ],
      ]),
      customRulesById: new Map(),
    });

    const baselineCheck = baseline[0].evaluation?.gaps.find(
      (g) => g.code === "total_practice_hours"
    );
    const overriddenCheck = overridden[0].evaluation?.gaps.find(
      (g) => g.code === "total_practice_hours"
    );
    expect(baselineCheck?.detail?.required).toBe(
      canonical.structured.total_practice_hours_required
    );
    expect(overriddenCheck?.detail?.required).toBe(tighter);
  });
});
