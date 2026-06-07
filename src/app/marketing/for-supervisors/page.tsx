import Link from "next/link";
import {
  ShieldCheck,
  Clock,
  FileSignature,
  TrendingUp,
  Users,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "For licensed supervisors — AuditHalo mental health supervision software",
  description:
    "The supervision compliance system for mental health professionals. Track every supervised hour against your state board's requirements, capture intent-confirmed e-signatures, and generate board-ready audit packages. Built for LCMHCS, LPC-S, and qualified mental health supervisors in NC, CA, TX, FL, and NY.",
};

const steps = [
  {
    number: "01",
    title: "Set up your roster",
    body: "Create your supervisor account, invite your supervisees by email. Their accounts are free — they join in under a minute.",
  },
  {
    number: "02",
    title: "Log sessions and sign",
    body: "Log each supervision session. Generate a structured note from your transcript. Both of you sign with intent confirmation — the record is sealed.",
  },
  {
    number: "03",
    title: "Audit-ready on demand",
    body: "Every hour, every signature, and every session note lives in one tamper-evident record. If your board asks, you produce it in seconds.",
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: "You're the one the board calls.",
    body: "If a supervisee's hours don't pass review, the board doesn't just deny the supervisee — they come to you. AuditHalo keeps your roster's hour totals continuously reconciled against the live state rule, with a citation-linked audit trail for every hour logged.",
  },
  {
    icon: Clock,
    title: "Stop managing hours in spreadsheets.",
    body: "One dashboard. Every supervisee. Live hour progress. At-risk flags 60 days before a deadline, not two weeks after. Spreadsheets don't grandfather you when the board changes a rule. AuditHalo does.",
  },
  {
    icon: FileSignature,
    title: "Sign in two clicks.",
    body: "Intent-confirmed e-signatures from any device. The evidence package is generated, SHA-256 hashed, and locked in the same flow — the same standard of proof your board would build themselves.",
  },
  {
    icon: Sparkles,
    title: "AI-assisted session notes.",
    body: "Paste a supervision transcript and get a structured note covering competencies, topics addressed, supervisor feedback, and next steps. Review, edit, and sign. Documentation that used to take 30 minutes takes 3.",
  },
  {
    icon: TrendingUp,
    title: "Your supervisees get a real product.",
    body: "Their account is free and polished. They see their progress meter, get deadline reminders, and track their own hours. You don't have to convince them to use a new tool — they'll want to.",
  },
  {
    icon: Users,
    title: "Built for how supervision actually works.",
    body: "Individual and group sessions. Multiple supervisees. Triadic supervision. Supervisor credential validation at the time of signing, not retroactively. Every edge case the board cares about — handled.",
  },
];

const stateGrid = [
  {
    code: "NC",
    credential: "LCMHCA",
    hours: "3,000",
    supervision: "100 hrs (≥75% individual)",
    window: "2–5 years",
    cadence: "1 hr per 40 practice hrs",
    slug: "nc-lcmhca",
  },
  {
    code: "CA",
    credential: "APCC",
    hours: "3,000",
    supervision: "Weekly cadence",
    window: "Up to 6 years",
    cadence: "1 hr/week (contact weeks)",
    slug: "ca-apcc",
  },
  {
    code: "TX",
    credential: "LPC-Associate",
    hours: "3,000",
    supervision: "4 hrs/month",
    window: "18 mo. minimum",
    cadence: "≥1 individual/month",
    slug: "tx-lpc-associate",
  },
  {
    code: "FL",
    credential: "RMHCI",
    hours: "1,500",
    supervision: "100 hrs (≥50% individual)",
    window: "60 mo. max (non-renewable)",
    cadence: "~1 hr per 2 weeks",
    slug: "fl-rmhci",
  },
  {
    code: "NY",
    credential: "LP-MHC",
    hours: "3,000",
    supervision: "~100 hrs",
    window: "Up to 3 years",
    cadence: "Regular and consistent",
    slug: "ny-lmhc-lp",
  },
];

const objections = [
  {
    objection: "I already track hours in a spreadsheet.",
    response:
      "Spreadsheets don't version-lock when the board changes a rule. They don't produce a hash-stamped evidence package. They don't flag a supervisee 60 days before their deadline. And they don't capture an intent-confirmed signature that satisfies a board reviewer. Spreadsheets are what you use until you need something that holds up.",
  },
  {
    objection: "My EHR already has supervisor co-signature.",
    response:
      "Co-signature on a clinical note is not a supervision audit package. EHRs document client care — AuditHalo documents the supervisory relationship and proves to the board that supervision happened, was properly structured, and meets the hour requirements for your state.",
  },
  {
    objection: "Sounds expensive for a part-time supervisor.",
    response:
      "$89/month covers up to 3 supervisees — $30 per supervisee. Each one pays you $75–$150/hour for supervision. If AuditHalo saves you one hour of paperwork per supervisee per month, it pays for itself three times over.",
  },
  {
    objection: "What if my supervisee is in a state you don't support?",
    response:
      "We launched with NC, CA, TX, FL, and NY because that's where the volume is. Tell us your state — we'll prioritize encoding it. Enterprise customers get custom state additions.",
  },
];

// FAQ — first four answer the most common objections from the marketing
// playbook (tracker / EHR co-sign / HIPAA / state not listed). The fifth
// is the practical "how long" question prospects ask once they're sold.
const faqItems = [
  {
    q: "My supervisees already use a tracker (Time2Track, etc.). Why switch?",
    a: "A tracker is a log; AuditHalo is the audit record. Logs count hours. They don't version-lock when a board updates a rule, don't produce a tamper-evident hash-stamped package, and don't capture the intent-confirmed signature a state reviewer wants to see. AuditHalo is what holds up when the board actually asks for proof — not what you use to count.",
  },
  {
    q: "My EHR has a supervisor co-signature. Isn't that enough?",
    a: "Co-signature on a clinical note documents the client encounter, not the supervisory relationship. State boards review supervision audits against their admin code — total hours, individual-vs-group ratios, cadence, supervisor credentials at the time of signing — none of which an EHR is built to produce. AuditHalo complements SimplePractice / TherapyNotes / ICANotes; it doesn't replace them.",
  },
  {
    q: "Is my data safe? Is this HIPAA?",
    a: "Supervision notes in AuditHalo document the supervisory relationship — competencies addressed, supervisor feedback, hour totals — not client treatment records. Data is encrypted in transit and at rest. Evidence packages are independently verifiable by hash. For group practices that need a signed BAA, we're building toward HIPAA-covered enterprise — get in touch via the contact form to discuss specifics.",
  },
  {
    q: "What if my state isn't listed?",
    a: "We launched with NC, CA, TX, FL, and NY because that's where the volume is. Tell us your state — we prioritize encoding new rules by demand. Enterprise customers can request custom state additions on a faster timeline.",
  },
  {
    q: "How long does setup take?",
    a: "Under 15 minutes to create your account, set up your org, and invite your first supervisee. The supervisee gets an email, creates a free account, and you're tracking against the live state rule from the next logged session.",
  },
];

export default function ForSupervisorsPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge variant="outline">For Licensed Supervisors</Badge>
          <Badge variant="outline">LCMHCS · LPC-S · LCSW-S · Qualified Supervisor</Badge>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground max-w-4xl leading-[1.05]">
          The supervision compliance system for mental health professionals.
        </h1>
        {/*
         * Locked campaign headline (brand-voice.md). Lives as the hero
         * subhead so it's the first thing a prospect reads after the H1 —
         * the line that names the outcome they actually want.
         */}
        <p className="mt-6 font-display text-xl sm:text-2xl font-medium text-foreground/85 max-w-3xl leading-snug">
          When the board asks, the answer&apos;s already in a folder.
        </p>
        <p className="mt-4 text-lg text-foreground/70 max-w-2xl leading-relaxed">
          AuditHalo is the supervision compliance platform for licensed
          mental health supervisors in NC, CA, TX, FL, and NY. Track every
          supervised hour against the live state rule, capture intent-confirmed
          e-signatures, and generate tamper-evident audit packages — without a
          single spreadsheet.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href="https://app.audithalo.com/register">
              Start your supervisor account <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground/60">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
            14-day free trial
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
            No credit card required
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
            Supervisee accounts always free
          </span>
        </div>
      </section>

      {/* Risk callout */}
      <section className="border-y border-border bg-[color:var(--color-risk)]/5">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-start gap-4">
            <AlertTriangle
              className="h-6 w-6 mt-1 shrink-0 text-[color:var(--color-risk)]"
              strokeWidth={1.75}
            />
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                When a supervisee's audit fails, the board comes to you first.
              </h2>
              <p className="mt-2 text-foreground/70 max-w-3xl">
                In every state we cover, the supervisor signs attesting to the
                hours. If those hours don't pass the board's review, your
                supervisor credential is at risk — not just the supervisee's
                application. AuditHalo exists to make sure that never happens.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            How it works
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-2xl">
            Set up in 15 minutes. Audit-ready for the next 5 years.
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
            {steps.map((s) => (
              <div key={s.number} className="bg-background p-8">
                <p className="font-mono text-3xl font-bold text-foreground/20 mb-4">
                  {s.number}
                </p>
                <h3 className="font-display text-xl font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 text-foreground/70 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Why supervisors switch
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-2xl">
            Built around what your day actually looks like.
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f) => (
              <Card key={f.title}>
                <CardContent className="p-8">
                  <f.icon className="h-6 w-6 text-secondary" strokeWidth={1.75} />
                  <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-foreground/70 leading-relaxed">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* State compliance grid */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Supported states
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-2xl">
            Your state's requirements, encoded.
          </h2>
          <p className="mt-3 text-foreground/70 max-w-2xl">
            Every rule is pulled directly from the state administrative code,
            citation-linked, and re-verified quarterly by licensed clinical
            supervisors. When requirements change, we encode the new rule — your
            in-progress supervisees stay grandfathered.
          </p>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-6 label-overline font-medium">State</th>
                  <th className="text-left py-3 pr-6 label-overline font-medium">Credential</th>
                  <th className="text-left py-3 pr-6 label-overline font-medium">Practice hours</th>
                  <th className="text-left py-3 pr-6 label-overline font-medium">Supervision</th>
                  <th className="text-left py-3 pr-6 label-overline font-medium">Window</th>
                  <th className="text-left py-3 label-overline font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {stateGrid.map((s) => (
                  <tr key={s.code} className="border-b border-border/50 hover:bg-card transition-colors">
                    <td className="py-4 pr-6 font-display text-lg font-bold text-foreground">
                      {s.code}
                    </td>
                    <td className="py-4 pr-6 font-mono text-xs text-foreground/70">{s.credential}</td>
                    <td className="py-4 pr-6 text-foreground">{s.hours}</td>
                    <td className="py-4 pr-6 text-foreground/80">{s.supervision}</td>
                    <td className="py-4 pr-6 text-foreground/80">{s.window}</td>
                    <td className="py-4">
                      <Link
                        href={`/states/${s.slug}`}
                        className="text-xs text-secondary hover:underline whitespace-nowrap"
                      >
                        Full requirements →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Objection handling */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Honest answers
          </Badge>
          <h2 className="font-display text-3xl font-semibold text-foreground">
            What we hear from supervisors.
          </h2>
          <div className="mt-10 space-y-8">
            {objections.map((o) => (
              <div key={o.objection}>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  "{o.objection}"
                </h3>
                <p className="mt-2 text-foreground/70 leading-relaxed">{o.response}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing summary */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Pricing
          </Badge>
          <h2 className="font-display text-3xl font-semibold text-foreground max-w-2xl">
            Priced per supervisee. Your account is included.
          </h2>
          <p className="mt-3 text-foreground/70 max-w-xl">
            The supervisor is the one with board liability. So they're the buyer.
            The supervisee has the audit on the line — so their account is free.
          </p>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-px bg-border">
            <div className="bg-background p-8">
              <p className="label-overline mb-3">Supervisee</p>
              <p className="font-display text-4xl font-bold text-foreground">Free</p>
              <p className="mt-2 text-sm text-foreground/60">Always. No time limit.</p>
              <ul className="mt-6 space-y-2 text-sm text-foreground/70">
                {["Hour progress dashboard", "Supervisor connection", "Session history", "Evidence package access"].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-background p-8 ring-2 ring-secondary ring-inset">
              <div className="flex items-baseline justify-between">
                <p className="label-overline mb-3">Solo Supervisor</p>
                <Badge variant="secondary">Most popular</Badge>
              </div>
              <p className="font-display text-4xl font-bold text-foreground">$89</p>
              <p className="mt-2 text-sm text-foreground/60">per month · up to 3 supervisees</p>
              <ul className="mt-6 space-y-2 text-sm text-foreground/70">
                {["Supervisor dashboard", "State rules engine", "E-signature + audit package", "AI session notes", "Hour progress tracking"].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
                {["HR dashboard", "Multi-supervisor org"].map((f) => (
                  <li key={f} className="flex items-start gap-2 opacity-40">
                    <X className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-8 w-full">
                <a href="https://app.audithalo.com/register?plan=solo">
                  Start 14-day trial <ArrowRight />
                </a>
              </Button>
            </div>
            <div className="bg-background p-8">
              <p className="label-overline mb-3">Practice</p>
              <p className="font-display text-4xl font-bold text-foreground">$25</p>
              <p className="mt-2 text-sm text-foreground/60">per supervisee / month + $49 base</p>
              <ul className="mt-6 space-y-2 text-sm text-foreground/70">
                {["Everything in Solo Supervisor", "4–20 supervisees", "All 5 supported states", "HR dashboard + heatmap", "Executive risk rollup", "7-year audit retention"].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-8 w-full">
                <a href="https://app.audithalo.com/register?plan=practice">
                  Start 14-day trial <ArrowRight />
                </a>
              </Button>
            </div>
          </div>
          <p className="mt-6 text-sm text-foreground/60 text-center">
            Annual billing available — 2 months free.{" "}
            <Link href="/pricing" className="text-secondary hover:underline">
              Full pricing details →
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            FAQ
          </Badge>
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Common questions.
          </h2>
          <div className="mt-10 space-y-8">
            {faqItems.map((item) => (
              <div key={item.q}>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {item.q}
                </h3>
                <p className="mt-2 text-foreground/70 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Try it on your real roster.
          </h2>
          <p className="mt-4 text-foreground/70">
            14 days, no card. Bring your supervisees in, assign their state rule,
            and see the dashboard fill up.
          </p>
          <Button asChild size="lg" className="mt-8">
            <a href="https://app.audithalo.com/register">
              Start your supervisor account <ArrowRight />
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
