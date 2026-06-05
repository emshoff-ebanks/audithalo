import { PainPage } from "@/components/marketing/pain-page";

const URL = "https://audithalo.com/apcc-supervision-requirements";

export const metadata = {
  title:
    "APCC supervision requirements (California) — every rule explained | AuditHalo",
  description:
    "APCC supervision requirements in California explained: 3,000 hours, 6-year window, supervisor training, weekly cadence, the BBS supervisor credential, and the registration deadline that trips up most candidates.",
  alternates: { canonical: URL },
};

export default function ApccSupervisionRequirementsPage() {
  return (
    <PainPage
      url={URL}
      badge="APCC supervision requirements"
      h1="APCC supervision requirements — the California rule, explained."
      intro="If you're an Associate Professional Clinical Counselor (APCC) in California (or supervising one), the BBS supervision rule has unusual cadence and supervisor-training requirements that don't appear in other states. Here's every requirement, the supervisor-training step most candidates underestimate, and the registration deadline that determines whether your hours are valid at all."
      metaDescription={metadata.description!}
      bodyParagraphs={[
        "The Associate Professional Clinical Counselor (APCC) is California's pre-licensure registration for counselors working toward the LPCC. To complete the APCC obligation, you accumulate 3,000 hours of supervised post-degree experience over a six-year window — the longest window of any state we cover. The BBS specifies a weekly supervision cadence and an unusual 15-hour supervisor-training requirement.",
        "The single most important step: register as an APCC within 90 days of graduation. If you don't register within 90 days, hours of supervised practice before registration do not count. This trips up more APCC candidates than any other rule. AuditHalo flags any practice session before the registration date with a hard-blocking gap.",
        "The supervisor-training requirement (16 CCR §1822) is unusual: your APCC supervisor must have completed at least 15 hours of supervision training. Many counselors who supervise without this training assume their supervision satisfies the BBS — it does not. AuditHalo snapshots the supervisor's verified training hours onto every supervision session you log. If your supervisor is short of the 15-hour threshold, every session they sign is blocked from counting.",
        "Weekly cadence: at least 1 hour of individual or triadic supervision per week of practice (16 CCR §1820). If you work a full clinical week without supervision, that week's hours don't count toward your total. AuditHalo tracks this rolling weekly window automatically and surfaces gaps at the earliest opportunity.",
      ]}
      keyPoints={[
        {
          title: "3,000 hours over up to 6 years",
          body: "Long window, but you must register as an APCC with the BBS within 90 days of degree completion or your obligation clock doesn't start cleanly.",
        },
        {
          title: "Supervisor needs 15 training hours",
          body: "16 CCR §1822 requires your supervisor to have at least 15 hours of supervision training. AuditHalo blocks supervision sessions where the supervisor is short.",
        },
        {
          title: "Weekly supervision required",
          body: "16 CCR §1820 requires 1+ hour of individual or triadic supervision per week of practice. AuditHalo surfaces any week you missed.",
        },
        {
          title: "BBS-registered supervisor only",
          body: "Generic clinical-supervisor certifications don't satisfy the BBS. The supervisor's credential is validated at the moment of signing.",
        },
      ]}
      faq={[
        {
          q: "How many supervised hours does an APCC need in California?",
          a: "3,000 hours of supervised post-degree experience over up to a 6-year window. The BBS requires at least 1 hour of individual or triadic supervision per week of practice.",
        },
        {
          q: "What does the 15-hour supervisor training requirement mean?",
          a: "Under 16 CCR §1822, an APCC supervisor must complete at least 15 hours of supervision training before supervising. AuditHalo snapshots your supervisor's verified training hour count onto every supervision session and blocks the session from counting if the supervisor is short of 15.",
        },
        {
          q: "What happens if I don't register as an APCC within 90 days of graduation?",
          a: "Hours of supervised practice before BBS registration do not count toward licensure. The BBS does not make retroactive exceptions. This is the single most common cause of failed APCC audits. Register early.",
        },
        {
          q: "Can group supervision count for the weekly cadence requirement?",
          a: "16 CCR §1820 requires individual or triadic supervision (one supervisor, one or two supervisees) for the weekly requirement. Group supervision counts toward your total supervision hours but does not satisfy the weekly cadence.",
        },
        {
          q: "What if my APCC obligation runs past 6 years?",
          a: "The supervisee must reapply. The BBS does not automatically extend the window. AuditHalo's permit_expiration_window check flags this 90+ days in advance.",
        },
      ]}
      ctaHeading="Track APCC supervision against the exact California rule."
    />
  );
}
