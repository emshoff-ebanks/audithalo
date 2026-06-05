import { PainPage } from "@/components/marketing/pain-page";

const URL = "https://audithalo.com/lcmhca-supervision-requirements";

export const metadata = {
  title:
    "LCMHCA supervision requirements (NC) — every rule explained | AuditHalo",
  description:
    "LCMHCA supervision requirements in North Carolina explained: 3,000 hours, supervisor credential rules, individual-supervision share, cadence, the supervision contract, and how to stay audit-ready.",
  alternates: { canonical: URL },
};

export default function LcmhcaSupervisionRequirementsPage() {
  return (
    <PainPage
      url={URL}
      badge="LCMHCA supervision requirements"
      h1="LCMHCA supervision requirements — the North Carolina rule, explained."
      intro="If you're an LCMHCA in North Carolina (or supervising one), the NC Board's supervision rule is more detailed than most state boards. Here's every requirement, every common failure mode, and the supervision contract step that determines whether any of your hours count at all."
      metaDescription={metadata.description!}
      bodyParagraphs={[
        "The Licensed Clinical Mental Health Counselor Associate (LCMHCA) is North Carolina's pre-licensure credential for counselors working toward the full LCMHC. To earn the LCMHCA, you accumulate 3,000 hours of supervised practice under an NC Board-approved supervisor (LCMHCS), over a two-to-five-year window, with a specific cadence and supervision-to-practice ratio.",
        "The single most expensive mistake LCMHCA candidates make: logging practice hours before the supervision contract is filed with and approved by the NC Board. Hours that pre-date the filing don't count — and the Board doesn't make exceptions. The contract is filed by you and your LCMHCS together; AuditHalo flags any session date before the filing date with a hard-blocking gap.",
        "Other key requirements: 1 hour of individual or 2 hours of group supervision per 40 practice hours; at least 75% of supervision must be individual; group sessions cap at 12 attendees; the supervisor must hold the LCMHCS credential issued by the NC Board (not a generic clinical supervisor certification); both parties sign every supervision session with intent confirmation; and the supervisee must accumulate 3,000 hours within a two-to-five-year obligation window.",
        "AuditHalo encodes every one of these against the NC Board's exact citation (21 NCAC 53). Every supervision session you log is evaluated against the rule in real-time. The dashboard surfaces gaps — credential mismatches, cadence violations, individual-share drops below 75% — months before a Board audit would catch them.",
      ]}
      keyPoints={[
        {
          title: "3,000 hours over 2–5 years",
          body: "The obligation window is statutory. AuditHalo surfaces the remaining months and predicts whether you'll meet the total at your current cadence.",
        },
        {
          title: "Supervision contract is the gate",
          body: "Hours logged before the NC Board-filed contract do not count. AuditHalo blocks any pre-filing session from accruing toward your total.",
        },
        {
          title: "LCMHCS-only supervision",
          body: "Generic clinical-supervisor certifications don't satisfy NC. Every supervision session's supervisor credential is snapshotted and validated at signing.",
        },
        {
          title: "75% individual-supervision share",
          body: "Falling below 75% individual is the second-most-common audit failure. AuditHalo tracks the running share live; you see the number drop before it becomes a problem.",
        },
      ]}
      faq={[
        {
          q: "How many supervised hours does an LCMHCA need in North Carolina?",
          a: "3,000 hours of supervised practice, accumulated over a 2-to-5-year window. The hours include both direct client contact and other professional duties, but the supervision cadence is tied to direct practice hours specifically.",
        },
        {
          q: "What does the NC supervision contract require?",
          a: "A signed agreement between the LCMHCA candidate and the LCMHCS supervisor, filed with the NC Board and approved before any hour can count. The contract names the supervisor, the supervision setting, and the supervision frequency. Until the contract is filed and approved, no logged hour counts toward licensure.",
        },
        {
          q: "What's the NC supervision cadence requirement?",
          a: "At least 1 hour of individual supervision (or 2 hours of group) for every 40 practice hours. Group sessions cap at 12 attendees. At least 75% of all supervision must be individual to count toward the LCMHCA.",
        },
        {
          q: "Who counts as a qualified supervisor for an LCMHCA?",
          a: "Only an LCMHCS — the Licensed Clinical Mental Health Counselor Supervisor credential issued by the NC Board. A generic clinical-supervisor certification from a non-NC body does not satisfy the requirement.",
        },
        {
          q: "What happens if the LCMHCA's hours exceed the 5-year window?",
          a: "The supervisee must reapply or seek an extension. The NC Board does not automatically extend the window. AuditHalo's permit_expiration_window check flags this 90+ days in advance so you have time to plan.",
        },
      ]}
      ctaHeading="Track LCMHCA supervision against the exact NC rule."
    />
  );
}
