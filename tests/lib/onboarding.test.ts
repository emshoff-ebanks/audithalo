import { describe, it, expect } from "vitest";
import { computeOnboardingSteps } from "@/lib/onboarding";

describe("computeOnboardingSteps", () => {
  it("returns all-false when no subscription and empty roster", () => {
    const result = computeOnboardingSteps({
      subscriptionStatus: null,
      roster: [],
    });
    expect(result.stepDone).toEqual([false, false, false]);
    expect(result.allDone).toBe(false);
  });

  it("marks only step 1 done when trialing with empty roster", () => {
    const result = computeOnboardingSteps({
      subscriptionStatus: "trialing",
      roster: [],
    });
    expect(result.stepDone).toEqual([true, false, false]);
    expect(result.allDone).toBe(false);
  });

  it("marks steps 1+2 done when active with unassigned supervisee", () => {
    const result = computeOnboardingSteps({
      subscriptionStatus: "active",
      roster: [{ evaluation: null }],
    });
    expect(result.stepDone).toEqual([true, true, false]);
    expect(result.allDone).toBe(false);
  });

  it("marks all three steps done when active with a fully evaluated roster", () => {
    const result = computeOnboardingSteps({
      subscriptionStatus: "active",
      roster: [{ evaluation: { riskLevel: "green" } }, { evaluation: { riskLevel: "yellow" } }],
    });
    expect(result.stepDone).toEqual([true, true, true]);
    expect(result.allDone).toBe(true);
  });

  it("does not mark step 3 done if any supervisee has no rule assignment", () => {
    const result = computeOnboardingSteps({
      subscriptionStatus: "past_due",
      roster: [{ evaluation: { riskLevel: "green" } }, { evaluation: null }],
    });
    expect(result.stepDone).toEqual([true, true, false]);
    expect(result.allDone).toBe(false);
  });

  it("does not count a canceled subscription as active (step 1 false)", () => {
    const result = computeOnboardingSteps({
      subscriptionStatus: "canceled",
      roster: [{ evaluation: { riskLevel: "green" } }],
    });
    expect(result.stepDone).toEqual([false, true, true]);
    expect(result.allDone).toBe(false);
  });
});
