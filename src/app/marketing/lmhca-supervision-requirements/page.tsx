import { PainPage } from "@/components/marketing/pain-page";

const URL = "https://audithalo.com/lmhca-supervision-requirements";

export const metadata = {
  title:
    "LMHCA supervision requirements (Washington) — every rule explained | AuditHalo",
  description:
    "LMHCA supervision requirements in Washington explained: 3,000 hours, 100 immediate supervision hours, the 1-in-80 cadence, CACREP credit, the supervisor declaration, and how to stay audit-ready.",
  alternates: { canonical: URL },
};

export default function LmhcaSupervisionRequirementsPage() {
  return (
    <PainPage
      url={URL}
      badge="LMHCA supervision requirements"
      h1="LMHCA supervision requirements — the Washington rule, explained."
      intro="If you're an LMHCA in Washington (or supervising one), the Department of Health's supervision rule has two traps most candidates miss: the 100 required hours must be immediate supervision — group time does not count — and the supervisor declaration has to be signed before supervision begins. Here's every requirement, every common failure mode, and how to keep your supervised hours board-defensible."
      metaDescription={metadata.description!}
      datePublished="2026-09-10"
      bodyParagraphs={[
        "The Licensed Mental Health Counselor Associate (LMHCA) is Washington's pre-independent counseling credential for professionals working toward the full LMHC. To earn the LMHC, you accumulate 3,000 hours of supervised postgraduate experience over at least 36 months, including 1,200 or more direct client contact hours and at least 100 hours of immediate supervision. The rule is encoded in Chapter 246-809 WAC (WAC 246-809-230, -234, -020, and -210).",
        "The most expensive misread of the Washington rule is treating all supervision as equal. The 100-hour minimum must be immediate supervision — one supervisor with no more than two candidates. Group supervision, which Washington allows up to six candidates, does NOT count toward that 100-hour obligation (WAC 246-809-230(3)(b)(i)). AuditHalo classifies every session by attendee count at signing, so group hours never quietly inflate your immediate-supervision total.",
        "The second trap is timing. The supervisor must provide a signed declaration on the DOH form before supervision begins (WAC 246-809-234(3)) — this is the pre-registration gate, and hours that pre-date it are exposed in an audit. Your supervisor must also be a licensed LMHC or equally qualified practitioner (LMFT, LICSW, Psychologist, Psychiatrist, or Psychiatric NP), in good standing without restrictions for the prior two years. Cadence runs on a ratio: 1 hour of supervision per 80 hours of clinical practice (WAC 246-809-020(2)(b)). CACREP graduates receive credit for 500 practice hours and 50 supervision hours (WAC 246-809-230(4)).",
        "AuditHalo encodes every one of these against Washington's exact citation. Each supervision session you log is evaluated against the rule in real time. The dashboard surfaces gaps — a supervisor credential that lapsed, an immediate-supervision share running short, a cadence ratio slipping behind 1-in-80, a missing declaration date — months before a Department of Health audit would catch them. As of October 1, 2025, applicants may practice under supervision for up to 120 days while their LMHCA application is pending; AuditHalo tracks that window so nothing accrues outside it.",
      ]}
      keyPoints={[
        {
          title: "3,000 hours over 36+ months",
          body: "The minimum span is statutory, not just the total. AuditHalo surfaces remaining months and direct-contact hours, and predicts whether you'll clear 3,000 (and 1,200 direct) at your current cadence.",
        },
        {
          title: "100 hours must be immediate",
          body: "Group supervision does not count toward the 100-hour minimum. AuditHalo classifies each session by attendee count and tracks the immediate-supervision total separately, so the ratio you report is board-defensible.",
        },
        {
          title: "Declaration before supervision begins",
          body: "The signed supervisor declaration is the pre-registration gate. AuditHalo flags any session dated before the declaration so pre-filing hours never enter your evidence package unnoticed.",
        },
        {
          title: "1-in-80 cadence, LMHC-qualified supervisor",
          body: "One supervision hour per 80 practice hours, delivered by a licensed LMHC or equally qualified practitioner in good standing. AuditHalo snapshots the supervisor's credential at signing and tracks the running ratio live.",
        },
      ]}
      faq={[
        {
          q: "How many supervised hours does an LMHCA need in Washington?",
          a: "3,000 hours of supervised postgraduate experience over at least 36 months, including at least 1,200 direct client contact hours and at least 100 hours of immediate supervision. CACREP graduates receive credit for 500 practice hours and 50 supervision hours (WAC 246-809-230).",
        },
        {
          q: "What counts as immediate supervision in Washington?",
          a: "Immediate supervision is one supervisor with no more than two candidates present — it does not have to be strictly one-on-one. Only immediate supervision counts toward the 100-hour minimum. Group supervision, allowed up to six candidates, does not count toward that obligation (WAC 246-809-210, WAC 246-809-230).",
        },
        {
          q: "Who qualifies as an LMHCA supervisor in Washington?",
          a: "A licensed LMHC or an equally qualified practitioner — LMFT, LICSW, Licensed Psychologist, Licensed Psychiatrist, or Licensed Psychiatric Nurse Practitioner — licensed without restrictions and in good standing for the prior two years, with 15+ hours of clinical supervision training and 25 hours of supervision experience (WAC 246-809-234).",
        },
        {
          q: "How often must supervision happen in Washington?",
          a: "The cadence is a ratio, not a fixed weekly meeting: at least 1 hour of supervision for every 80 hours of clinical practice (WAC 246-809-020(2)(b)). AuditHalo tracks the running ratio so a supervisee never drifts behind the 1-in-80 obligation.",
        },
        {
          q: "Does AuditHalo generate the documentation Washington requires?",
          a: "Yes. AuditHalo produces a tamper-evident evidence package for each supervision session — date, duration, session type, supervisor credential, and dual signatures — and supports the periodic submission of supervision hours to the Department of Health required by WAC 246-809-020(3)(c).",
        },
      ]}
      ctaHeading="Track LMHCA supervision against the exact Washington rule."
    />
  );
}
