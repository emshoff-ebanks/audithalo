/**
 * Pure helper: compute the 3-step onboarding checklist state for a supervisor's
 * dashboard from the org's subscription status and current roster.
 *
 * Step 1: org has an active billing subscription (mirrors seats.ts ACTIVE_STATUSES)
 * Step 2: at least one supervisee on the roster
 * Step 3: every supervisee has a state rule assigned (evaluation !== null)
 *
 * Pure function — no DB, no I/O. The UI component (_onboarding-checklist.tsx)
 * consumes the result.
 */

import { ACTIVE_STATUSES } from "@/lib/billing/seats";

export type OnboardingInputs = {
  subscriptionStatus: string | null;
  roster: { evaluation: unknown | null }[];
};

export type OnboardingSteps = {
  stepDone: [boolean, boolean, boolean];
  allDone: boolean;
};

export function computeOnboardingSteps(
  inputs: OnboardingInputs
): OnboardingSteps {
  const step1 =
    !!inputs.subscriptionStatus && ACTIVE_STATUSES.has(inputs.subscriptionStatus);
  const step2 = inputs.roster.length > 0;
  const step3 =
    inputs.roster.length > 0 &&
    inputs.roster.every((r) => r.evaluation !== null);
  const stepDone: [boolean, boolean, boolean] = [step1, step2, step3];
  return { stepDone, allDone: stepDone.every(Boolean) };
}
