import { describe, it, expect } from "vitest";
import { computeOnboardingSteps } from "@/lib/onboarding";

const baseInputs = {
  supervisorTrainingHours: null,
  rosterHasTrainingRequiredRule: false,
};

describe("computeOnboardingSteps", () => {
  it("returns all-false when nothing done", () => {
    const result = computeOnboardingSteps({
      ...baseInputs,
      emailVerifiedAt: null,
      subscriptionStatus: null,
      roster: [],
    });
    expect(result.stepDone).toEqual([false, false, false, false]);
    expect(result.allDone).toBe(false);
  });

  it("marks only step 1 (email verification) done", () => {
    const result = computeOnboardingSteps({
      ...baseInputs,
      emailVerifiedAt: new Date(),
      subscriptionStatus: null,
      roster: [],
    });
    expect(result.stepDone).toEqual([true, false, false, false]);
    expect(result.allDone).toBe(false);
  });

  it("marks steps 1+2 done when verified and trialing with empty roster", () => {
    const result = computeOnboardingSteps({
      ...baseInputs,
      emailVerifiedAt: new Date(),
      subscriptionStatus: "trialing",
      roster: [],
    });
    expect(result.stepDone).toEqual([true, true, false, false]);
    expect(result.allDone).toBe(false);
  });

  it("marks steps 1+2+3 done when active with unassigned supervisee", () => {
    const result = computeOnboardingSteps({
      ...baseInputs,
      emailVerifiedAt: new Date(),
      subscriptionStatus: "active",
      roster: [{ evaluation: null }],
    });
    expect(result.stepDone).toEqual([true, true, true, false]);
    expect(result.allDone).toBe(false);
  });

  it("marks all four steps done when fully complete", () => {
    const result = computeOnboardingSteps({
      ...baseInputs,
      emailVerifiedAt: new Date(),
      subscriptionStatus: "active",
      roster: [
        { evaluation: { riskLevel: "green" } },
        { evaluation: { riskLevel: "yellow" } },
      ],
    });
    expect(result.stepDone).toEqual([true, true, true, true]);
    expect(result.allDone).toBe(true);
  });

  it("does not mark step 4 done if any supervisee has no rule assignment", () => {
    const result = computeOnboardingSteps({
      ...baseInputs,
      emailVerifiedAt: new Date(),
      subscriptionStatus: "past_due",
      roster: [
        { evaluation: { riskLevel: "green" } },
        { evaluation: null },
      ],
    });
    expect(result.stepDone).toEqual([true, true, true, false]);
    expect(result.allDone).toBe(false);
  });

  it("does not count a canceled subscription as active (step 2 false)", () => {
    const result = computeOnboardingSteps({
      ...baseInputs,
      emailVerifiedAt: new Date(),
      subscriptionStatus: "canceled",
      roster: [{ evaluation: { riskLevel: "green" } }],
    });
    expect(result.stepDone).toEqual([true, false, true, true]);
    expect(result.allDone).toBe(false);
  });

  it("unverified email blocks step 1 even when everything else is done", () => {
    const result = computeOnboardingSteps({
      ...baseInputs,
      emailVerifiedAt: null,
      subscriptionStatus: "active",
      roster: [{ evaluation: { riskLevel: "green" } }],
    });
    expect(result.stepDone).toEqual([false, true, true, true]);
    expect(result.allDone).toBe(false);
  });

  it("adds 5th step (training) when rosterHasTrainingRequiredRule and marks it pending without hours", () => {
    const result = computeOnboardingSteps({
      emailVerifiedAt: new Date(),
      subscriptionStatus: "active",
      roster: [{ evaluation: { riskLevel: "green" } }],
      supervisorTrainingHours: null,
      rosterHasTrainingRequiredRule: true,
    });
    expect(result.stepDone).toEqual([true, true, true, true, false]);
    expect(result.allDone).toBe(false);
  });

  it("marks 5th step done when supervisor training hours > 0", () => {
    const result = computeOnboardingSteps({
      emailVerifiedAt: new Date(),
      subscriptionStatus: "active",
      roster: [{ evaluation: { riskLevel: "green" } }],
      supervisorTrainingHours: 15,
      rosterHasTrainingRequiredRule: true,
    });
    expect(result.stepDone).toEqual([true, true, true, true, true]);
    expect(result.allDone).toBe(true);
  });

  it("treats 0 training hours as not done", () => {
    const result = computeOnboardingSteps({
      emailVerifiedAt: new Date(),
      subscriptionStatus: "active",
      roster: [{ evaluation: { riskLevel: "green" } }],
      supervisorTrainingHours: 0,
      rosterHasTrainingRequiredRule: true,
    });
    expect(result.stepDone).toEqual([true, true, true, true, false]);
    expect(result.allDone).toBe(false);
  });
});
