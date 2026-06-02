import Link from "next/link";
import {
  BarChart3,
  ShieldCheck,
  Users,
  AlertTriangle,
  FileCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "For Practices — AuditHalo",
  description:
    "Compliance oversight across every supervisor and supervisee in your practice. One dashboard, every state, no spreadsheets.",
};

const wins = [
  {
    icon: BarChart3,
    title: "See the whole practice at a glance.",
    body: "Your HR admin sees every supervisee's compliance status across every supervisor in a single heatmap. No chasing down spreadsheets. No surprises two weeks before a board deadline.",
  },
  {
    icon: ShieldCheck,
    title: "One non-compliant supervisee is a practice liability.",
    body: "If a board audit finds a gap in any supervisee's record, the consequences touch the supervising clinician and, by extension, the practice. AuditHalo flags at-risk supervisees 60 days before their deadline — not after.",
  },
  {
    icon: Users,
    title: "Your supervisors aren't spreadsheet janitors.",
    body: "Your licensed supervisors should spend their hours growing clinicians, not reconciling hour logs. AuditHalo handles the reconciliation — against the live state rule, citation-linked, re-verified quarterly.",
  },
  {
    icon: FileCheck,
    title: "Audit-ready on demand.",
    body: "When a state board requests records, you produce a SHA-256-hashed evidence package for every supervisee — signed, immutable, and independently verifiable. No scrambling, no reconstruction.",
  },
];

const practiceFeatures = [
  "All supervisors and supervisees in one org",
  "HR Admin dashboard with compliance heatmap",
  "Exception report — who's at risk and by how much",
  "Bulk export of evidence packages",
  "All 5 supported states under one subscription",
  "Executive risk rollup for clinical directors",
  "7-year audit log retention (matches most state board requirements)",
  "SSO / SAML (ship date: Q3)",
];

export default function ForPracticesPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <Badge variant="outline" className="mb-6">
          For Practices
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground max-w-4xl leading-[1.05]">
          Compliance oversight for every supervisee in your practice — not just
          the ones who remembered to log their hours.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl leading-relaxed">
          Group practices and agencies don't have a supervision problem — they
          have a visibility problem. AuditHalo gives HR admins and clinical
          directors a real-time compliance view across every supervisor,
          supervisee, and state rule in the organization.
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
                board asks — and by then, it's a reconstruction problem.
              </h2>
              <p className="mt-2 text-foreground/70 max-w-3xl">
                Supervision hour logs that live in spreadsheets, email threads,
                and individual supervisors' notes cannot be produced as a
                coherent, tamper-evident record on short notice. AuditHalo
                builds that record continuously — every hour logged, every
                session signed, every evidence package hashed — so audit
                readiness is a status, not a project.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Wins */}
      <section className="bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Why practices switch
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-2xl">
            Built for the people who see the whole org.
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {wins.map((w) => (
              <Card key={w.title}>
                <CardContent className="p-8">
                  <w.icon
                    className="h-6 w-6 text-secondary"
                    strokeWidth={1.75}
                  />
                  <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                    {w.title}
                  </h3>
                  <p className="mt-2 text-foreground/70 leading-relaxed">
                    {w.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Practice features list */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-1">
              <Badge variant="outline" className="mb-4">
                Practice tier
              </Badge>
              <h2 className="font-display text-3xl font-semibold text-foreground">
                Everything your supervisors get, plus the org-wide view.
              </h2>
              <p className="mt-4 text-foreground/70">
                $25 per supervisee / month + $49 base. Annual billing only.
                Supervisor and HR admin seats included.
              </p>
              <Button asChild className="mt-8">
                <Link href="/pricing">
                  Full pricing breakdown <ArrowRight />
                </Link>
              </Button>
            </div>
            <Card className="lg:col-span-2">
              <CardContent className="p-8">
                <ul className="space-y-3">
                  {practiceFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <ShieldCheck
                        className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]"
                        strokeWidth={2}
                      />
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-card">
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
              <a href="mailto:hello@audithalo.com?subject=Practice%20plan%20demo">
                Talk to us first
              </a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
