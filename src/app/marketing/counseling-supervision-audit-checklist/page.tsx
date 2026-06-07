import { PainPage } from "@/components/marketing/pain-page";

const URL = "https://audithalo.com/counseling-supervision-audit-checklist";

export const metadata = {
  title:
    "Counseling supervision audit checklist — what state boards actually check | AuditHalo",
  description:
    "A counseling supervision audit checklist for clinical supervisors. The 12 items most state boards check, the three that fail the most supervisees, and how to be ready in an afternoon.",
  alternates: { canonical: URL },
};

export default function CounselingSupervisionAuditChecklistPage() {
  return (
    <PainPage
      url={URL}
      badge="Counseling supervision audit checklist"
      h1="The counseling supervision audit checklist that boards actually use."
      intro="If your state board has scheduled a supervision audit — or you're trying to get ahead of one — here's the checklist they're actually working from. Most supervisees pass the easy items; the audits fail on three specific ones. Here's how to know whether you're in the clear."
      metaDescription={metadata.description!}
      bodyParagraphs={[
        "State counseling boards (LCMHC, LPC, LCSW) don't publish their internal audit checklists, but the structure across NC, CA, TX, FL, and NY converges on the same 12 items. Three of those items account for nearly every failed audit. Knowing which ones means the difference between a clean audit and a reapplication.",
        "The 12 items: supervision contract on file with the board, supervisor credential at the moment of each session, total practice hours met, total supervision hours met, individual-supervision share above the minimum, cadence within the maximum gap, group session attendee cap not exceeded, ratio of practice-to-supervision satisfied per block, session types properly logged, both-party signatures present, immutability of the supervision record, and consistency with state-board hour totals.",
        "The three that fail the most: (1) supervisor credential snapshot — the supervisor was credentialed when supervision was provided but you can't prove it because you didn't record it at the time; (2) cadence — you took a six-week break during a busy clinical month and the gap exceeded the state's maximum; (3) immutability — your supervision log lives in Google Sheets and the auditor doesn't trust that you haven't backfilled it.",
        "AuditHalo addresses all three at the point of capture. Supervisor credentials are snapshotted onto every supervision session automatically. Cadence is monitored continuously with at-risk flags 60 days before any deadline. Immutability comes from SHA-256 hashing the evidence package at the moment of signing — auditors can independently verify it without trusting you.",
      ]}
      keyPoints={[
        {
          title: "Three items fail most audits",
          body: "Supervisor credential gap, cadence gap, immutability gap. Everything else is bookkeeping.",
        },
        {
          title: "60-day at-risk flags",
          body: "AuditHalo predicts cadence failures 60 days before they happen, while you still have time to schedule make-up sessions.",
        },
        {
          title: "Credential snapshot at signing",
          body: "Every supervision session captures the supervisor's credential automatically — no reconstruction required at audit time.",
        },
        {
          title: "Evidence package per session",
          body: "One sealed PDF per signed session. State boards can verify each one independently via a public URL.",
        },
      ]}
      faq={[
        {
          q: "What does a counseling supervision audit checklist actually include?",
          a: "Roughly 12 items: supervision contract on file, supervisor credential at each session, practice-hour totals, supervision-hour totals, individual-supervision share, cadence, group session caps, supervision-to-practice ratio, session-type accuracy, signatures, immutability of records, and consistency with the board's hour totals.",
        },
        {
          q: "Which audit items fail the most supervisees?",
          a: "Three: missing supervisor-credential snapshots, cadence gaps from busy clinical months, and immutability concerns with spreadsheet-based supervision logs. All three are at the moment-of-capture level — they can't be reconstructed after the fact.",
        },
        {
          q: "Can I run my own pre-audit before the board does?",
          a: "Yes — AuditHalo runs the same evaluation continuously. The roster shows each supervisee's risk level (green / yellow / red) updated every time you log a session. You'll see gaps months before a board audit would catch them.",
        },
        {
          q: "How long does it take to get audit-ready with AuditHalo?",
          a: "If you're starting from scratch: an afternoon. Sign up, import or invite your supervisees, assign their state rule, and start logging sessions. The dashboard surfaces every gap immediately so you know exactly what to backfill.",
        },
      ]}
      ctaHeading="Run your own audit checklist in an afternoon."
      leadMagnet={{
        slug: "nc-supervision-audit-checklist",
        label: "NC Supervision Audit Checklist",
        heading: "Get the printable NC supervision audit checklist.",
        description:
          "The 12 fields a NC LCMHCA audit reviews, the 3 that fail the most, and a one-page session log you can fill in by hand. Drafted from 21 NCAC 53; reviewed against NCBLCMHC guidance.",
      }}
    />
  );
}
