/**
 * Pure helper: compute the onboarding checklist state for a supervisor's
 * dashboard.
 *
 * Step 1: email verified (users.emailVerifiedAt !== null)
 * Step 2: org has an active billing subscription (mirrors seats.ts ACTIVE_STATUSES)
 * Step 3: at least one supervisee on the roster
 * Step 4: every supervisee has a state rule assigned (evaluation !== null)
 * Step 5: (conditional) supervisor training on file — only shown when at
 *         least one roster supervisee is on a rule that requires it
 *         (e.g. CA APCC's 15-hour 16 CCR §1822 rule).
 *
 * Pure function — no DB, no I/O. The UI component (_onboarding-checklist.tsx)
 * consumes the result.
 */

import { ACTIVE_STATUSES } from "@/lib/billing/seats";

export type OnboardingInputs = {
  emailVerifiedAt: Date | null;
  subscriptionStatus: string | null;
  roster: { evaluation: unknown | null }[];
  supervisorTrainingHours: number | null;
  /** True when at least one roster supervisee is on a rule that includes
   *  a supervisor_training_course_required check. */
  rosterHasTrainingRequiredRule: boolean;
};

export type OnboardingSteps = {
  /** Step 5 (training) is only present when rosterHasTrainingRequiredRule. */
  stepDone: [boolean, boolean, boolean, boolean] | [boolean, boolean, boolean, boolean, boolean];
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

  if (inputs.rosterHasTrainingRequiredRule) {
    const step5 =
      inputs.supervisorTrainingHours !== null &&
      inputs.supervisorTrainingHours > 0;
    const stepDone: [boolean, boolean, boolean, boolean, boolean] = [
      step1,
      step2,
      step3,
      step4,
      step5,
    ];
    return { stepDone, allDone: stepDone.every(Boolean) };
  }

  const stepDone: [boolean, boolean, boolean, boolean] = [
    step1,
    step2,
    step3,
    step4,
  ];
  return { stepDone, allDone: stepDone.every(Boolean) };
}
