import { PainPage } from "@/components/marketing/pain-page";

const URL = "https://audithalo.com/lacmh-supervision-requirements";

export const metadata = {
  title:
    "LACMH supervision requirements (Delaware) — every rule explained | AuditHalo",
  description:
    "Delaware LACMH supervision requirements explained: 3,200 hours over 2-4 years, 1,600 clinical and 1,500 face-to-face hours, 100 supervision hours, board plan pre-approval, and how to stay audit-ready.",
  alternates: { canonical: URL },
};

export default function LacmhSupervisionRequirementsPage() {
  return (
    <PainPage
      url={URL}
      badge="LACMH supervision requirements"
      h1="LACMH supervision requirements — the Delaware rule, explained."
      intro="If you hold Delaware's LACMH (or supervise one), the Board's rule has more moving parts than most: two hour floors inside the total, an individual-face-to-face sub-minimum, a group-hour cap, and a supervision plan that must be board-approved before a single hour counts. Here's every requirement, every common failure mode, and how AuditHalo keeps your evidence package audit-ready."
      metaDescription={metadata.description!}
      datePublished="2026-09-10"
      bodyParagraphs={[
        "The Licensed Associate Counselor of Mental Health (LACMH) is Delaware's pre-independent counseling license — a full license issued by the Board of Mental Health and Chemical Dependency Professionals, not a registration. To advance to the full LPCMH, you accumulate 3,200 supervised practice hours over two-to-four consecutive years under professional direct supervision, per 24 DE Admin. Code 3000 and 24 Del. C. §§ 3030-3034.",
        "The single most expensive mistake LACMH candidates make: acquiring experience before the supervision plan is filed with and approved by the Board. Under 24 Del. C. § 3033(b) this is statutory, not discretionary — hours logged before plan approval do not count toward the 3,200. The plan is submitted by you and your supervisor together, and AuditHalo blocks any session dated before the approved plan from accruing, flagging it as a hard gap rather than letting it silently inflate your total.",
        "Inside the 3,200 total, Delaware layers three sub-requirements you have to track independently: at least 1,600 hours of supervised clinical experience, at least 1,500 hours of face-to-face direct client contact, and — the one candidates miss — at least 750 of those 1,500 must be individual face-to-face sessions, since group, couple, and family work can only fill the other 750. Delaware defines face-to-face to include live video, so telehealth sessions count for both client contact and supervision meetings.",
        "On top of practice hours sits 100 hours of clinical supervision: at least 60 must be individual, group supervision is capped at 40 hours, and no group session may exceed 6 supervisees. The supervisor is, by default, a Licensed Professional Counselor of Mental Health (LPCMH) holding a license in any US state; other credentials require Board approval and a compelling clinical reason. AuditHalo encodes each of these against the exact citation (24 DE Admin. Code 3000, §§ 2.0-3.0) and evaluates every session you log in real time, so a shortfall in the individual-supervision share or the group cap surfaces months before a board audit would catch it — with a board-defensible evidence package behind every number.",
      ]}
      keyPoints={[
        {
          title: "3,200 hours over 2-4 consecutive years",
          body: "The window is statutory and must run consecutively. AuditHalo tracks remaining months against your current cadence and predicts whether you'll clear the total in time.",
        },
        {
          title: "Board-approved plan is the gate",
          body: "Hours acquired before the Board approves your supervision plan do not count (24 Del. C. § 3033(b)). AuditHalo blocks any pre-approval session from accruing toward the 3,200.",
        },
        {
          title: "1,500 face-to-face, 750 individual",
          body: "At least 1,500 of the 3,200 must be face-to-face direct client contact, and at least 750 of those must be individual. AuditHalo tracks each sub-total live so neither floor sneaks up on you.",
        },
        {
          title: "100 supervision hours, 60 individual",
          body: "Group supervision caps at 40 hours and 6 supervisees per session. AuditHalo keeps the running individual-supervision share and group-session size validated at signing.",
        },
      ]}
      faq={[
        {
          q: "How many supervised hours does a LACMH need in Delaware?",
          a: "3,200 total supervised practice hours over two-to-four consecutive years. Within that total, at least 1,600 must be supervised clinical experience, at least 1,500 must be face-to-face direct client contact (with 750 or more of those individual), and at least 100 must be clinical supervision hours (60 or more individual, 40 maximum group).",
        },
        {
          q: "Does the supervision plan have to be board-approved before I start?",
          a: "Yes. Under 24 Del. C. § 3033(b) the plan must be submitted to and approved by the Delaware Board before you acquire any professional counseling experience. It's statutory, not discretionary — hours logged before plan approval do not count, and the Board does not make exceptions.",
        },
        {
          q: "Who qualifies as an approved LACMH supervisor in Delaware?",
          a: "The default supervisor is a Licensed Professional Counselor of Mental Health (LPCMH) holding a license in any US state or territory. Other licensed professionals — LMFT, psychologist, LCSW, physician, or APRN — may supervise only with Board approval and a compelling clinical reason. Every supervisor must have at least two years post-licensure experience, no disciplinary actions, and clinical-supervision CE credit.",
        },
        {
          q: "Can supervision and client contact be done over video in Delaware?",
          a: "Yes. Delaware's rule (24 DE Admin. Code 3000, § 2.3) defines face-to-face to include both in-person and live video conferencing. That applies to direct client contact hours and to supervision meetings, so compliant telehealth work counts toward both totals.",
        },
        {
          q: "How does AuditHalo keep my Delaware supervised hours audit-ready?",
          a: "AuditHalo generates a tamper-evident evidence package for every supervision session — date, duration, session type, supervisor credential snapshot, and intent-confirmed signatures from both parties — each SHA-256 hashed and immutable. Every session is evaluated against the citation in real time, so any gap in the 3,200 total, the sub-minimums, the individual-supervision share, or the group cap is board-defensible and surfaces before an audit.",
        },
      ]}
      ctaHeading="Track LACMH supervision against the exact Delaware rule."
    />
  );
}
