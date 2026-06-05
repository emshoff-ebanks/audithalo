/**
 * Pure helper: compute the 4-step onboarding checklist state for a supervisor's
 * dashboard from the org's subscription status, current roster, and the
 * supervisor's email verification state.
 *
 * Step 1: email verified (users.emailVerifiedAt !== null)
 * Step 2: org has an active billing subscription (mirrors seats.ts ACTIVE_STATUSES)
 * Step 3: at least one supervisee on the roster
 * Step 4: every supervisee has a state rule assigned (evaluation !== null)
 *
 * Pure function — no DB, no I/O. The UI component (_onboarding-checklist.tsx)
 * consumes the result.
 */

import { ACTIVE_STATUSES } from "@/lib/billing/seats";

export type OnboardingInputs = {
  emailVerifiedAt: Date | null;
  subscriptionStatus: string | null;
  roster: { evaluation: unknown | null }[];
};

export type OnboardingSteps = {
  stepDone: [boolean, boolean, boolean, boolean];
  allDone: boolean;
};

export function computeOnboardingSteps(
  inputs: OnboardingInputs
): OnboardingSteps {
  const step1 = inputs.emailVerifiedAt !== null;
  const step2 =
    !!inputs.subscriptionStatus && ACTIVE_STATUSES.has(inputs.subscriptionStatus);
  const step3 = inputs.roster.length > 0;
  const step4 =
    inputs.roster.length > 0 &&
    inputs.roster.every((r) => r.evaluation !== null);
  const stepDone: [boolean, boolean, boolean, boolean] = [
    step1,
    step2,
    step3,
    step4,
  ];
  return { stepDone, allDone: stepDone.every(Boolean) };
}
