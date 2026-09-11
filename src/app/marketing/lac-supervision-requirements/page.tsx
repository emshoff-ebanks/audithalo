import { PainPage } from "@/components/marketing/pain-page";

const URL = "https://audithalo.com/lac-supervision-requirements";

export const metadata = {
  title:
    "LAC supervision requirements (Arizona): every rule explained | AuditHalo",
  description:
    "Arizona LAC supervision requirements explained: 3,200 hours, 100 supervision hours, direct-observation and telehealth limits, supervisor credentials, and how to stay audit-ready.",
  alternates: { canonical: URL },
};

export default function LacSupervisionRequirementsPage() {
  return (
    <PainPage
      url={URL}
      badge="LAC supervision requirements"
      h1="LAC supervision requirements: the Arizona rule, explained."
      intro="If you supervise a Licensed Associate Counselor in Arizona, the Board grades the whole record: 3,200 supervised practice hours over at least 24 months, 100 clinical supervision hours, and a stack of telehealth, observation, and cadence limits that all have to line up. AuditHalo evaluates every one of those rules against your logged hours in real time and surfaces the gap before the board does."
      metaDescription={metadata.description!}
      datePublished="2026-09-10"
      bodyParagraphs={[
        "First, a disambiguation that trips up half the searches: in Arizona, LAC means Licensed Associate Counselor, the pre-independent counseling credential a candidate holds while working toward the LPC. It is not the addiction-counselor license some other states abbreviate the same way. The rules below come from the Arizona Board of Behavioral Health Examiners and its administrative code (A.A.C. R4-6-212, R4-6-503, and R4-6-504), under A.R.S. Title 32, Chapter 33. Those are the citations a board reviewer will hold your record against, so they are the citations AuditHalo tracks to.",
        "The headline obligation is 3,200 hours of supervised work experience spread across at least 24 months, and at least 1,600 of those must be direct client contact involving psychotherapy (R4-6-503(A)). Indirect hours alone never satisfy the requirement, and no more than 400 of the 1,600 direct hours may be psychoeducation. The balance has to be psychotherapy. Layered on top is a separate 100-hour clinical supervision obligation (R4-6-504(A)): at least 25 of those hours must be individual, up to 75 may be in dyads of two, and up to 50 may be in groups of three to six. A single group session is capped at six supervisees (R4-6-212(G)). Whenever the associate is seeing clients, supervision must occur at least once a month, for a minimum of one hour (R4-6-503(B)).",
        "The format rules are where audit-ready records fall apart, because they are granular and easy to breach without noticing. At least 2 hours of face-to-face supervision are required per six-month period. Fully remote supervision is not permitted (R4-6-212(D)). At least 10 of the 100 supervision hours must involve direct observation of the associate providing services (R4-6-212(E)). Telehealth is allowed but bounded: up to 90 of the 100 hours may be delivered by videoconference and telephone combined, but no more than 15 may be by telephone alone (R4-6-212(D)). Every session must run at least 30 minutes, and no more than six supervisors total may contribute hours toward one LPC application (R4-6-212(D), R4-6-212(F)). Each of these is a distinct ratio AuditHalo computes continuously, so a supervisee who is drifting toward too much phone time or too little direct observation shows up as a flagged gap months before the application deadline.",
        "Supervisor credentials carry their own obligation. The supervisor must hold an independent-level Arizona behavioral health license (LPC, LCSW, LMFT, licensed psychologist, or psychiatrist), and a substance-abuse counselor cannot provide hours toward LPC licensure (R4-6-504(C), R4-6-504(D)). Supervisors complete 12 clock hours of initial supervisor training and 6 hours per renewal cycle, waived only for those holding an NBCC Approved Clinical Supervisor, ICRC, or AAMFT Approved Supervisor designation (R4-6-212(J), R4-6-212(L)). Contemporaneous written records must be retained for at least seven years (R4-6-212(C)(4)). AuditHalo captures every session as a tamper-evident evidence package: date, duration, session type, supervisor credential, topics, and intent-confirmed signatures from both parties, SHA-256 hashed and immutable. The board-defensible record already exists on the day the LPC application goes in."
      ]}
      keyPoints={[
        {
          title: "3,200 hours, 1,600 of it direct",
          body:
            "Associates need 3,200 supervised practice hours across at least 24 months, with 1,600+ in direct client contact (R4-6-503(A)). AuditHalo tracks direct and indirect hours separately and enforces the 400-hour psychoeducation cap on the direct total."
        },
        {
          title: "100 supervision hours, 25 individual",
          body:
            "Of the 100 clinical supervision hours, at least 25 must be individual; groups are capped at six supervisees (R4-6-504(A), R4-6-212(G)). One hour of supervision every month of active practice is the floor. AuditHalo alerts on any 31-day gap."
        },
        {
          title: "Observation and telehealth limits",
          body:
            "At least 10 hours must be direct observation and at least 2 face-to-face hours are required per six-month period; up to 90 of 100 hours may be remote, but no more than 15 by telephone (R4-6-212(D)-(E)). Each limit is a live ratio, not a year-end reconciliation."
        },
        {
          title: "Independent-level supervisor, trained",
          body:
            "The supervisor must hold an independent AZ license (LPC, LCSW, LMFT, psychologist, or psychiatrist) with the required supervisor training, and no more than six supervisors may contribute to one application (R4-6-504(D), R4-6-212(F), R4-6-212(J))."
        }
      ]}
      faq={[
        {
          q: "How many supervised hours does an LAC need in Arizona?",
          a: "3,200 hours of supervised work experience over at least 24 months, including at least 1,600 hours of direct client contact (psychotherapy) under R4-6-503(A). Within that time you must also accumulate 100 clinical supervision hours, at least 25 of which must be individual. AuditHalo tracks both totals against the citation and flags the shortfall long before your LPC application is due."
        },
        {
          q: "Is the Arizona LAC the same as an addiction LAC in other states?",
          a: "No. In Arizona, LAC stands for Licensed Associate Counselor, the pre-independent counseling credential on the path to the LPC, issued by the Arizona Board of Behavioral Health Examiners. It is a different license from the addiction-counselor abbreviations some other states use, and the supervision rules that apply are A.A.C. R4-6-212, R4-6-503, and R4-6-504."
        },
        {
          q: "Who can supervise an Arizona LAC?",
          a: "Your supervisor must hold an independent-level Arizona behavioral health license (LPC, LCSW, LMFT, licensed psychologist, or psychiatrist, per R4-6-504(D)) and complete 12 hours of initial supervisor training plus 6 continuing-education hours per renewal cycle. Substance-abuse counselors cannot provide clinical supervision hours toward LPC licensure, and no more than six supervisors total may contribute to a single application."
        },
        {
          q: "Can Arizona supervision be done over telehealth?",
          a: "Mostly, within limits. Up to 90 of the 100 supervision hours may be delivered by videoconference and telephone combined, but no more than 15 may be by telephone alone (R4-6-212(D)). At least 2 hours must be face-to-face per six-month period, and at least 10 hours must involve direct observation of the associate providing services. AuditHalo computes each ratio in real time so a supervisee never quietly exceeds the remote or telephone caps."
        },
        {
          q: "How does AuditHalo keep an Arizona supervision record audit-ready?",
          a: "AuditHalo evaluates every logged session against each rule in R4-6-212, R4-6-503, and R4-6-504 as it happens: hours, ratios, cadence, observation, supervisor credential. It surfaces any gap before a board audit. Each session becomes a tamper-evident evidence package with date, duration, session type, credentials, topics, and intent-confirmed signatures, SHA-256 hashed and retained to satisfy the seven-year record obligation, so the board-defensible package is ready the day you apply."
        }
      ]}
      ctaHeading="Track LAC supervision against the exact Arizona rule."
    />
  );
}
