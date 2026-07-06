export type ClinicalFormData = {
  // Page 1 — initial supervision plan (first session only)
  isInitialPlan?: boolean;
  frequencyPlan?:
    | "weekly"
    | "biweekly"
    | "monthly"
    | "bimonthly"
    | "quarterly"
    | "as_needed";
  policyReviewed?: boolean;
  contractAgreedUpon?: boolean;

  // Page 2 — Section I: core skills + competencies
  coreSkillsChecked?: string[];
  competenciesChecked?: string[];
  otherCoreSkill?: string;

  // Page 2 — Section II: action steps (individual sessions)
  actionSteps?: Array<{ step: string; targetDate: string }>;

  // Page 2 — Section III: group discussion topics (group sessions)
  groupDiscussionTopics?: string;

  // Page 2 — follow-up from previous session
  followUpFromPrevious?: string;

  // Page 3 — Section IV: training / CEU needs
  trainingNeeds?: string;
  teamBenefit?: string;

  // Page 3 — Section V: case review findings
  caseReviewFindings?: string;
  medicationReview?: string;

  // Page 3 — Section VI: additional context / feedback
  additionalContext?: string;

  // Identity fields for PDF signature blocks (not in user profile)
  superviseeJobTitle?: string;
  superviseeCredentials?: string;

  // "Other" supervision type qualifier
  supervisionTypeOther?: string;
};
