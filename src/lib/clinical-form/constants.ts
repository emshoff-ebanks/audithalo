/**
 * RI Clinical Supervision Form — field definitions.
 *
 * These mirror the checkboxes and categories on Recovery Innovations'
 * 3-page Clinical Supervision Form (updated 11/11/2024). Keys are
 * stable identifiers stored in clinicalFormData JSONB; labels are
 * the exact text from RI's form.
 */

// ---------------------------------------------------------------------------
// Section I — Core skills (narrative checkbox items)
// ---------------------------------------------------------------------------

export const CORE_SKILLS = [
  {
    key: "barrier_intervention",
    label:
      "Identification and intervention to address barriers that impact the development of recovery skills necessary for independent functioning in the community.",
  },
  {
    key: "family_psycho_education",
    label:
      "Family psycho education development and revision of the recipient’s Person-Centered Plan based on recovery principles.",
  },
  {
    key: "interpersonal_community",
    label:
      "One-on-one interaction/support to develop interpersonal and community coping skills, mentoring; symptom monitoring through WRAP; monitoring medications; and self-management of symptoms as part of participant’s recovery.",
  },
  {
    key: "service_integration",
    label:
      "Arrange, link, or integrate multiple services as well as assessment and reassessment of the participants need for services.",
  },
  {
    key: "benefits_resources",
    label:
      "Support the participant in learning about benefits, community resources, and accessing benefits and services.",
  },
  {
    key: "medication_verification",
    label:
      "For authorized staff: verification of medication orders, checking for potential drug interactions, and ensuring that the medication administration is consistent with treatment plans.",
  },
  {
    key: "other",
    label: "Other",
  },
] as const;

export type CoreSkillKey = (typeof CORE_SKILLS)[number]["key"];

// ---------------------------------------------------------------------------
// Section I — Competency checkboxes (4-column grid)
// Items marked required: true have a * on RI's form.
// ---------------------------------------------------------------------------

export const COMPETENCIES = [
  // Row 1
  { key: "technical_knowledge", label: "Technical Knowledge", required: true },
  { key: "cultural_awareness", label: "Cultural Awareness", required: true },
  { key: "analytical_skills", label: "Analytical Skills", required: true },
  { key: "recovery_pathways", label: "Recovery Pathways in Practice", required: false },
  // Row 2
  { key: "decision_making", label: "Decision Making", required: true },
  { key: "interpersonal_skills", label: "Interpersonal Skills", required: true },
  { key: "communication_skills", label: "Communication Skills", required: true },
  { key: "ethics_boundaries", label: "Ethics, Boundaries & Integrity", required: false },
  // Row 3
  { key: "clinical_skills", label: "Clinical Skills", required: true },
  { key: "effective_listening", label: "Effective Listening", required: false },
  { key: "commitment_to_task", label: "Commitment to Task", required: false },
  { key: "problem_solving", label: "Problem Solving/Conflict Management", required: false },
  // Row 4
  { key: "flexibility", label: "Flexibility", required: false },
  { key: "resource_management", label: "Resource Management", required: false },
  { key: "documentation", label: "Documentation", required: false },
  { key: "relationship_management", label: "Relationship Management", required: false },
  // Row 5
  { key: "leadership", label: "Leadership", required: false },
  { key: "teamwork", label: "Teamwork", required: false },
  { key: "continuous_learning", label: "Continuous Learning", required: false },
  { key: "planning_prioritizing", label: "Planning, Prioritizing, Goal Setting", required: false },
  // Row 6
  { key: "continuing_education", label: "Continuing Education", required: true },
  { key: "trauma_informed_care", label: "Trauma-Informed Care", required: false },
  { key: "guest_rights", label: "Guest Rights", required: true },
  { key: "case_reviews", label: "Case Reviews/Chart Reviews", required: true },
  // Row 7
  { key: "crisis_intervention", label: "Crisis Intervention(s)", required: true },
  { key: "safety_protocols", label: "Safety Protocols", required: true },
  { key: "de_escalation", label: "De-Escalation", required: false },
] as const;

export type CompetencyKey = (typeof COMPETENCIES)[number]["key"];

// ---------------------------------------------------------------------------
// Supervision type labels (for UI display)
// ---------------------------------------------------------------------------

export const SUPERVISION_TYPE_LABELS: Record<string, string> = {
  peer: "Peer",
  nursing: "Nursing",
  clinician: "Clinician",
  administrative: "Administrative",
  app: "Advance Practice Provider",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Frequency plan labels
// ---------------------------------------------------------------------------

export const FREQUENCY_PLAN_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  bimonthly: "Bimonthly",
  quarterly: "Quarterly",
  as_needed: "As Needed",
};
