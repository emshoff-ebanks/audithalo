import { PainPage } from "@/components/marketing/pain-page";

const URL = "https://audithalo.com/ohio-lpc-supervision-requirements";

export const metadata = {
  title:
    "Ohio LPC supervision requirements (LPCC pathway) — every rule explained | AuditHalo",
  description:
    "Ohio LPC supervision requirements explained: 3,000 hours, the 1-in-20 supervision ratio, milestone evaluations at 1,500 and 3,000 hours, the training-supervision LPCC designation, and how to stay audit-ready.",
  alternates: { canonical: URL },
};

export default function OhioLpcSupervisionRequirementsPage() {
  return (
    <PainPage
      url={URL}
      badge="Ohio LPC supervision requirements"
      h1="Ohio LPC supervision requirements — the LPCC pathway, explained."
      intro="In Ohio, the Licensed Professional Counselor (LPC) is the pre-independent credential — you can counsel, but you can't independently diagnose or treat mental and emotional disorders until you earn the LPCC. Here's every supervision requirement on that pathway, the ratio that trips people up, and the milestone evaluations that decide whether your hours count."
      metaDescription={metadata.description!}
      datePublished="2026-09-10"
      bodyParagraphs={[
        "Ohio's pre-independent counseling pathway runs from Licensed Professional Counselor (LPC) to Licensed Professional Clinical Counselor (LPCC). The LPC is the pre-independent credential: you may practice counseling, but you cannot independently diagnose and treat mental and emotional disorders (MED) without supervision. To earn the LPCC, you complete 3,000 hours of supervised experience — including at least 1,500 face-to-face client contact hours involving MED diagnosis and treatment — over at least 24 months (OAC 4757-13-03, ORC 4757.22).",
        "The most expensive misread of the Ohio rule is the annual cap. No more than 1,500 hours of experience may be accrued in any 12-month period — a hard ceiling, not a guideline (OAC 4757-13-03(A)(4)(a)). Pack more than 1,500 hours into a single year and the overage simply doesn't count toward your 3,000. On top of that, at least half of each year's hours must be face-to-face client contact involving MED, so the 1,500-hour MED minimum is really an obligation you carry every year, not just at the finish line.",
        "Ohio supervises by ratio, not by a fixed total: 1 hour of supervision for every 20 hours of work by the supervisee, which lands at roughly 150 supervision hours across the full 3,000 (OAC 4757-17-01(B)). There is no required split between individual and group supervision. Group sessions cap at 8 supervisees; Ohio's \"individual\" supervision is unusual in that it permits up to 2 supervisees, so a two-person session still counts as individual here. Your training supervisor must be an LPCC holding the Board's training-supervision designation — a clinical or work supervisor such as a psychologist, psychiatrist, IMFT, or LISW may oversee the MED work but does not satisfy the training-supervision requirement (OAC 4757-17-01(D)).",
        "Ohio does not require a pre-filed supervision contract. Instead, the supervisee maintains supervision records acknowledged by the supervisor at least quarterly, and the supervisor submits milestone evaluations at 1,500 and 3,000 hours — each within 30 days of the supervisee's request, or the supervisor risks disciplinary action (OAC 4757-17-01(E)). The LPC must also disclose supervision status and name the supervisor on all printed and electronic client materials (OAC 4757-17-01(A)). AuditHalo encodes every one of these against the Board's exact citation and evaluates each logged session in real time, so the 1:20 ratio, the annual cap, and the two milestone deadlines surface as board-defensible gaps months before an audit would find them.",
      ]}
      keyPoints={[
        {
          title: "3,000 hours with a hard 1,500 annual cap",
          body: "You need 3,000 supervised hours over 24+ months, but no more than 1,500 count in any 12-month window. AuditHalo tracks the rolling annual total and flags overage before it stops accruing.",
        },
        {
          title: "Supervision is ratio-based, 1:20",
          body: "One supervision hour per 20 hours of work — about 150 hours total, with no fixed individual-to-group split. AuditHalo watches the running ratio and alerts your team when a supervisee falls behind.",
        },
        {
          title: "Milestone evaluations, not a contract",
          body: "Ohio skips the pre-filed contract and requires supervisor evaluations at 1,500 and 3,000 hours, each due within 30 days. AuditHalo counts down to both milestones so neither deadline is missed.",
        },
        {
          title: "Training supervision is LPCC-only",
          body: "Only an LPCC with the Board's training-supervision designation qualifies. AuditHalo snapshots and validates the supervisor's credential at signing on every session.",
        },
      ]}
      faq={[
        {
          q: "How many supervised hours does an Ohio LPC need for the LPCC?",
          a: "3,000 hours of supervised experience over at least 24 months, including at least 1,500 face-to-face client contact hours involving diagnosis and treatment of mental and emotional disorders. No more than 1,500 hours may be accrued in any 12-month period — that annual cap is a hard limit under OAC 4757-13-03(A)(4)(a).",
        },
        {
          q: "How many supervision hours are required in Ohio?",
          a: "Ohio uses a ratio rather than a fixed total: 1 hour of supervision for every 20 hours of work (OAC 4757-17-01(B)). Across the 3,000-hour requirement, that yields roughly 150 supervision hours. There is no required split between individual and group supervision.",
        },
        {
          q: "Who qualifies as a supervisor for an Ohio LPC?",
          a: "For training supervision toward the LPCC, the supervisor must be an LPCC holding the Board's training-supervision designation. Clinical or work supervisors — psychologists, psychiatrists, IMFTs, LISWs — may oversee MED activities but do not satisfy the training-supervision requirement (OAC 4757-17-01(D)).",
        },
        {
          q: "Does Ohio require a supervision contract before starting?",
          a: "No. Ohio does not require a pre-filed contract. The supervisee maintains supervision records acknowledged by the supervisor at least quarterly, and the supervisor submits milestone evaluations at 1,500 and 3,000 hours — each within 30 days of the supervisee's request (OAC 4757-17-01(E)).",
        },
        {
          q: "What does Ohio's group and individual supervision allow?",
          a: "Group supervision is capped at 8 supervisees. Ohio's \"individual\" supervision is unusual in that it permits up to 2 supervisees, so a two-person session still counts as individual here (OAC 4757-17-01(B)). AuditHalo classifies each session correctly for Ohio and tracks it against the 1:20 ratio.",
        },
      ]}
      ctaHeading="Track Ohio LPC supervision against the exact state rule."
    />
  );
}
