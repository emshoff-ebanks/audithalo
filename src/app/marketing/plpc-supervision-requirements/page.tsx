import { PainPage } from "@/components/marketing/pain-page";

const URL = "https://audithalo.com/plpc-supervision-requirements";

export const metadata = {
  title:
    "PLPC supervision requirements (Louisiana) — every rule explained | AuditHalo",
  description:
    "Louisiana PLPC supervision requirements explained: 3,000 hours, 100 supervision hours, the LPC-S requirement, the board-approved setting rule that can forfeit your hours, and how to stay audit-ready.",
  alternates: { canonical: URL },
};

export default function PlpcSupervisionRequirementsPage() {
  return (
    <PainPage
      url={URL}
      badge="PLPC supervision requirements"
      h1="PLPC supervision requirements — the Louisiana rule, explained."
      intro="If you're a Provisional Licensed Professional Counselor in Louisiana (or supervising one), the LPC Board's rule carries a trap most candidates never see coming — a practice-setting notification deadline that can forfeit every hour you've earned. Here's every requirement, every citation, and the two approval steps that decide whether your supervised hours count at all."
      metaDescription={metadata.description!}
      bodyParagraphs={[
        "The Provisional Licensed Professional Counselor (PLPC) is Louisiana's pre-independent credential for counselors working toward the full LPC. To earn it you accumulate 3,000 supervised practice hours — at least 1,900 direct counseling hours and at least 1,000 indirect hours — over a two-to-six-year window, plus 100 face-to-face supervision hours of which at least 50 must be individual. The cadence is ratio-based: 1 hour of supervision for every 20 direct client contact hours. All of this is set out in LAC 46:LX and the Mental Health Counselor Licensing Act at R.S. 37:1101–1123.",
        "The single most expensive mistake in Louisiana is not the supervision plan — it's the setting. Your practice setting must be board-approved before hours accrue there, and if you change or add a setting, you have 30 days to notify the Board. Miss that window and you forfeit ALL hours accrued at that setting (LAC 46:LX §603(A)(6)(d)). It is the harshest forfeiture rule in any state we track. AuditHalo timestamps every setting change and starts a 30-day countdown, so the obligation is visible long before it becomes a loss.",
        "Two approvals gate your hours from the start. First, the supervision plan must be filed and approved by the Board before the proposed start date — retroactive hours are explicitly prohibited (§605(A)(3)), and adding or changing supervisors requires the same prior approval. Second, your supervisor must hold the LPC-S (LPC-Supervisor) designation issued by the Louisiana LPC Board; no other license type qualifies. Louisiana also requires a separate on-site administrative supervisor (a licensed LPC, LMFT, or LCSW) available at the practice setting — distinct from your clinical LPC-S. Group supervision, if used, must have between 2 and 10 PLPCs, and supervision may be delivered up to 100% by synchronous HIPAA-compliant video, but never by mail, email, or telephone.",
        "AuditHalo encodes every one of these against the Board's exact citation. Each supervision session you log is evaluated against the rule in real time: the 1:20 ratio, the running individual-supervision share, the LPC-S credential snapshot at signing, the 2–6 year duration window, and the setting-approval status. The dashboard surfaces gaps — a ratio drift, an unapproved setting, an individual share below 50 hours — months before a board audit would, and every session produces a board-defensible evidence package with intent-confirmed signatures.",
      ]}
      keyPoints={[
        {
          title: "3,000 hours over 2–6 years",
          body: "At least 1,900 direct and 1,000 indirect hours inside a two-to-six-year obligation window. AuditHalo tracks each hour type separately and predicts whether you'll hit the total at your current cadence.",
        },
        {
          title: "The 30-day setting rule",
          body: "Fail to notify the Board of a new practice setting within 30 days and you forfeit every hour earned there. AuditHalo starts the countdown the moment a setting changes.",
        },
        {
          title: "LPC-S supervision only",
          body: "Only the LPC-Supervisor designation from the Louisiana LPC Board qualifies — no other license type. Each session's supervisor credential is snapshotted and validated at signing.",
        },
        {
          title: "100 supervision hours, 50+ individual",
          body: "Supervision runs at 1 hour per 20 direct client contact hours, with at least half of the 100 total hours individual. AuditHalo shows the running individual share live so it never drops unnoticed.",
        },
      ]}
      faq={[
        {
          q: "How many supervised hours does a PLPC need in Louisiana?",
          a: "3,000 total supervised practice hours over a 2-to-6-year window, including at least 1,900 direct counseling hours and at least 1,000 indirect hours, plus 100 face-to-face supervision hours of which at least 50 must be individual (LAC 46:LX §605).",
        },
        {
          q: "What happens if I move to a new practice setting?",
          a: "The setting must be board-approved before hours accrue there, and you must notify the Louisiana LPC Board within 30 days of any change. Missing that 30-day deadline forfeits every hour you earned at that setting (§603(A)(6)(d)) — AuditHalo tracks the deadline so this never happens silently.",
        },
        {
          q: "Who qualifies as a supervisor for a PLPC in Louisiana?",
          a: "Only a counselor holding the LPC-S (LPC-Supervisor) designation from the Louisiana LPC Board. That requires a Louisiana LPC in good standing, 3+ years of post-licensure experience, and completed supervision training. No other license type satisfies the requirement, and a separate on-site administrative supervisor (LPC, LMFT, or LCSW) is also required at the setting.",
        },
        {
          q: "Must the supervision plan be filed before I start?",
          a: "Yes. The supervision plan must be submitted on Board forms and approved before the proposed start date — retroactive hours are explicitly prohibited (§605(A)(3)). Adding or changing supervisors requires the same prior filing and approval before new hours can accrue.",
        },
        {
          q: "Can Louisiana PLPC supervision be done by video?",
          a: "Yes — up to 100% of the face-to-face supervision hours may be delivered by synchronous videoconferencing on a HIPAA-compliant platform. Supervision may not be conducted by mail, email, or telephone. AuditHalo records the session modality as part of each board-defensible evidence package.",
        },
      ]}
      datePublished="2026-09-10"
      ctaHeading="Track PLPC supervision against the exact Louisiana rule."
    />
  );
}
