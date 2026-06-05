import Link from "next/link";
import {
  BarChart3,
  ShieldCheck,
  Users,
  AlertTriangle,
  FileCheck,
  TrendingDown,
  ArrowRight,
  CheckCircle2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Mental health supervision tracking for group practices — AuditHalo",
  description:
    "Manage mental health supervision compliance across multiple supervisors and pre-licensed counselors in one dashboard. AuditHalo gives group practice owners and HR directors a real-time compliance view — so no supervisee falls through the cracks.",
};

const wins = [
  {
    icon: BarChart3,
    title: "One view across your entire practice.",
    body: "HR admins see every supervisee's compliance status across every supervisor — hours logged, hours remaining, at-risk flags — in a single dashboard. No chasing down individual spreadsheets. No surprises two weeks before a board deadline.",
  },
  {
    icon: ShieldCheck,
    title: "One non-compliant supervisee is a practice liability.",
    body: "A gap in any supervisee's supervision record touches the supervising clinician and, by extension, the practice. AuditHalo flags at-risk supervisees 60 days before their deadline — not after — so you have time to act.",
  },
  {
    icon: Users,
    title: "Multiple supervisors, one org.",
    body: "Your licensed supervisors manage their own rosters. HR sees across all of them. Evidence packages are consistent regardless of which supervisor logged the session. No two supervisors using different systems.",
  },
  {
    icon: FileCheck,
    title: "Audit-ready on demand.",
    body: "When a state board requests records, you produce a SHA-256-hashed evidence package for any supervisee — signed, immutable, independently verifiable. No reconstruction project.",
  },
  {
    icon: TrendingDown,
    title: "Supervision billing that makes sense.",
    body: "Per-supervisee seat pricing. Add a supervisee, add a seat — prorated to the hour. Drop one, drop a seat. Supervisor and HR admin accounts included with any paid plan. No surprises on the invoice.",
  },
];

const practiceFeatures = [
  "All supervisors and supervisees under one organization",
  "HR Admin dashboard with compliance heatmap by state and supervisee",
  "Exception report — who's at risk, by how much, and by when",
  "All 5 supported states under one subscription",
  "Executive risk rollup for clinical directors",
  "7-year audit log retention",
  "Bulk evidence package export",
  "Annual billing only (2 months free)",
];

const hrFeatures = [
  "Real-time compliance status for every supervisee in the practice",
  "At-risk flags 60 days before any deadline",
  "State board compliance mapped per supervisee",
  "One-click export for board audit responses",
  "Supervisor credential verification on every signed session",
];

export default function ForGroupPracticesPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge variant="outline">For Group Practices</Badge>
          <Badge variant="outline">Practice owners · HR directors · Clinical directors</Badge>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground max-w-4xl leading-[1.05]">
          Mental health supervision compliance across your whole practice — not
          just the supervisees who remembered to log their hours.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl leading-relaxed">
          Group practices don't have a supervision problem — they have a
          visibility problem. AuditHalo gives practice owners, HR admins, and
          clinical directors a single real-time view of every supervised
          associate's compliance status, across every supervisor and every state.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href="https://app.audithalo.com/register">
              Start 14-day trial <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">See Practice pricing</Link>
          </Button>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground/60">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
            14-day free trial
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
            Supervisor + HR admin seats included
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
                Most practice compliance failures aren't discovered until the
                board asks — and by then, it's a reconstruction project.
              </h2>
              <p className="mt-2 text-foreground/70 max-w-3xl">
                Supervision logs that live in individual supervisors' spreadsheets
                and email threads cannot be produced as a coherent, tamper-evident
                record on short notice. AuditHalo builds that record continuously —
                every hour logged, every session signed, every evidence package
                hashed — so audit-readiness is a status, not a project.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Wins */}
      <section className="bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Why group practices switch
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-2xl">
            Built for the people who see the whole org.
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wins.map((w) => (
              <Card key={w.title}>
                <CardContent className="p-8">
                  <w.icon className="h-6 w-6 text-secondary" strokeWidth={1.75} />
                  <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                    {w.title}
                  </h3>
                  <p className="mt-2 text-foreground/70 leading-relaxed">{w.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Two-audience section: practice owners + HR directors */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Practice tier */}
            <div>
              <Badge variant="outline" className="mb-4">Practice tier</Badge>
              <h2 className="font-display text-2xl font-semibold text-foreground">
                For practice owners with 4–20 associates.
              </h2>
              <p className="mt-3 text-foreground/70 mb-6">
                $25 per supervisee / month + $49 base. Annual billing only.
                Supervisor and HR admin seats included free.
              </p>
              <ul className="space-y-3">
                {practiceFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" strokeWidth={2.5} />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-8">
                <a href="https://app.audithalo.com/register?plan=practice">
                  Start 14-day trial <ArrowRight />
                </a>
              </Button>
            </div>

            {/* HR director value prop */}
            <div>
              <Badge variant="outline" className="mb-4">For HR directors</Badge>
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Compliance oversight without chasing supervisors.
              </h2>
              <p className="mt-3 text-foreground/70 mb-6">
                HR admins get a read-only view of every supervisor's roster and
                every supervisee's compliance status. No login sharing. No weekly
                status emails to supervisors. No surprises.
              </p>
              <ul className="space-y-3">
                {hrFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" strokeWidth={2.5} />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-8">
                <a href="mailto:info@audithalo.com?subject=Group%20practice%20demo">
                  Talk to us first <ArrowRight />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise callout */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="font-display text-xl font-semibold text-foreground">
                More than 20 supervisees, or multiple locations?
              </p>
              <p className="mt-1 text-foreground/70">
                Enterprise plans include custom state additions, SSO, API access,
                dedicated support, and a 7-year audit log export.
              </p>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <a href="mailto:info@audithalo.com?subject=Enterprise%20plan">
                Talk to sales <ArrowRight />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Start with your real roster.
          </h2>
          <p className="mt-4 text-foreground/70">
            14-day trial. No card. Bring your supervisors and supervisees in on
            day one.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="https://app.audithalo.com/register">
                Start 14-day trial <ArrowRight />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">Full pricing breakdown</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
