import { PainPage } from "@/components/marketing/pain-page";

const URL = "https://audithalo.com/supervision-log-template";

export const metadata = {
  title:
    "Supervision log template — what state boards actually accept | AuditHalo",
  description:
    "A free supervision log template won't pass a state board audit. Here's what licensing boards actually require — and why AuditHalo's sealed evidence packages replace the template entirely.",
  alternates: { canonical: URL },
};

export default function SupervisionLogTemplatePage() {
  return (
    <PainPage
      url={URL}
      badge="Supervision log template"
      h1="What a state board actually accepts as a supervision log."
      intro="If you're searching for a supervision log template, you're trying to solve the right problem with the wrong tool. A spreadsheet with date columns won't survive a state-board audit. Here's what licensing boards actually require — and why mental health supervisors are replacing templates with sealed evidence packages."
      metaDescription={metadata.description!}
      bodyParagraphs={[
        "Every state licensing board — NC LCMHCA, CA APCC, TX LPC-A, FL RMHCI, NY LP-MHC — has its own requirements for what a supervision log must show. None of them just want a date and a duration. They want the supervisor's credential at the moment of supervision, the type of session (individual, triadic, group), the supervisee's signature confirming intent, and a way to verify that the document hasn't been altered.",
        "A typical free supervision log template fails on all of these. It captures the date and duration; it leaves the credential field blank. It has no e-signature workflow. It has no integrity check. The supervisor types into a cell, the supervisee never sees it, and when the audit comes years later, neither party has independent proof the log reflects what actually happened.",
        "AuditHalo replaces the template entirely. Each supervision session is logged into a tamper-evident record at the moment it happens. The supervisor's credential is snapshotted from their account. Both parties sign with intent confirmation. The session is SHA-256 hashed and sealed into a downloadable PDF — an evidence package that any state board, employer, or auditor can paste into a verify-URL to confirm authenticity, years later.",
        "If you absolutely need a template right now — for an audit deadline tomorrow — most state boards accept a CSV export with the columns listed above. But for any supervisee whose hours you're still accumulating, switch to a system that captures evidence at the moment of supervision instead of reconstructing it after the fact.",
      ]}
      keyPoints={[
        {
          title: "What a real supervision log needs",
          body: "Date, duration, session type, supervisor credential, both-party signatures with intent, and an integrity hash. A template has the first two.",
        },
        {
          title: "Why reconstruction fails",
          body: "If you can't prove the supervisor was credentialed at the moment of supervision, the hour doesn't count. Templates can't prove this. Sealed packages can.",
        },
        {
          title: "What AuditHalo replaces",
          body: "Spreadsheet templates, free PDF forms, calendar exports — all of it. One sealed evidence package per session, hashed and timestamped.",
        },
        {
          title: "What boards actually want",
          body: "Independent verifiability. They want to confirm the record reflects what happened — without trusting your spreadsheet. Sealed packages give them that.",
        },
      ]}
      faq={[
        {
          q: "Is there a free supervision log template I can use right now?",
          a: "Most state board websites have a basic template you can download. They're acceptable as a temporary stopgap if you're behind on documentation, but they lack the credential snapshots, e-signature workflow, and integrity hashing that modern audit processes look for.",
        },
        {
          q: "What columns does a supervision log need?",
          a: "At minimum: date, duration, session type (individual / triadic / group), supervisor name and credential, supervisee name, attendees (for group), and both signatures. State boards increasingly want timestamps and integrity hashes too — neither of which a template can provide.",
        },
        {
          q: "How is AuditHalo different from a supervision log template?",
          a: "AuditHalo records the supervision session at the moment it happens, snapshots the supervisor's credential automatically, captures intent-confirmed e-signatures from both parties, and seals everything into a SHA-256-hashed PDF — an evidence package, not a spreadsheet row. State boards can independently verify each package via a public URL.",
        },
        {
          q: "What if my state board hasn't updated its template requirements?",
          a: "Most boards accept any documentation that's better than the minimum template. Sealed PDF evidence packages exceed the minimum on every state we support. The board's only question is usually \"is this real?\" — and the integrity hash answers it without anyone calling you.",
        },
      ]}
      ctaHeading="Stop maintaining a supervision log. Start sealing evidence."
    />
  );
}
