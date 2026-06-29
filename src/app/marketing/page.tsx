import Link from "next/link";
import {
  ShieldCheck,
  Scale,
  LayoutDashboard,
  Users,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  jsonLdScript,
  softwareApplicationJsonLd,
} from "@/lib/seo";

export const metadata = {
  title: "AuditHalo — State-board compliance software for mental health supervisors",
  description:
    "Track pre-licensed mental health counselor hours, signatures, and state-board requirements — then generate audit-ready evidence packages when your board asks. Built for LCMHCA, APCC, LPC-A, RMHCI, and LP-MHC supervisors.",
};

// The four locked value pillars from the brand voice doc — these are the
// spine of every marketing page. Same four titles + bodies appear on
// /features and /for-supervisors so the messaging compounds.
const valuePillars = [
  {
    icon: ShieldCheck,
    title: "Audit-defensible by default.",
    body: "Every signed session seals into a tamper-evident, SHA-256-hashed evidence package — contemporaneous, citation-linked, independently verifiable. The opposite of a reconstructed log.",
  },
  {
    icon: Scale,
    title: "The rules engine, kept current.",
    body: "Every hour evaluated against your state's exact admin code — 21 NCAC 53, 22 TAC 681, CCR Title 16, F.A.C. 64B4, NY permit rules. Citation-linked. Versioned. Grandfathered when boards update requirements.",
  },
  {
    icon: LayoutDashboard,
    title: "One dashboard for the whole roster.",
    body: "At-risk flags 60 days before a deadline, not two weeks after. Signature queue, progress at a glance, every supervisee in one view. Built for how supervision actually works.",
  },
  {
    icon: Users,
    title: "Free for supervisees, always.",
    body: "They carry the audit. They shouldn't carry the cost. Each supervisee gets a polished free account that tracks their own progress and shows them exactly where they stand.",
  },
];

const states = [
  { code: "NC", license: "LCMHCA", href: "/states/nc-lcmhca" },
  { code: "CA", license: "APCC", href: "/states/ca-apcc" },
  { code: "TX", license: "LPC-A", href: "/states/tx-lpc-associate" },
  { code: "FL", license: "RMHCI", href: "/states/fl-rmhci" },
  { code: "NY", license: "LP-MHC", href: "/states/ny-lmhc-lp" },
];

export default function MarketingHome() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(softwareApplicationJsonLd())}
      />
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24 lg:py-32">
        <Badge variant="outline" className="mb-6">
          Clinical supervision compliance software
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground max-w-3xl leading-[1.05]">
          State-board compliance software for mental health supervisors.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl leading-relaxed">
          Track pre-licensed counselor hours, signatures, and state-board
          requirements — then generate audit-ready evidence packages when your
          board asks.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href="https://app.audithalo.com/register">
              Start your supervisor account <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/for-supervisors">See how it works</Link>
          </Button>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground/60">
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

      {/* Value pillars — the spine of the marketing site. Same four pillars
          appear on /features and /for-supervisors. */}
      <section id="features" className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            What you get
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-2xl">
            Everything a state board audit requires. Nothing it doesn&apos;t.
          </h2>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
            {valuePillars.map((p) => (
              <div key={p.title} className="bg-card p-8">
                <p.icon className="h-6 w-6 text-secondary" strokeWidth={1.75} />
                <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-foreground/70 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* States supported */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Supported states
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-2xl">
            State board requirements, encoded.
          </h2>
          <p className="mt-3 text-foreground/70 max-w-2xl">
            Five states at launch — covering the majority of pre-licensed
            counselors in the US. Every rule is citation-linked to the state
            administrative code and re-verified quarterly.
          </p>
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border">
            {states.map((s) => (
              <Link
                key={s.code}
                href={s.href}
                className="bg-card p-6 hover:bg-accent transition-colors group"
              >
                <p className="font-display text-3xl font-bold text-foreground">
                  {s.code}
                </p>
                <p className="mt-1 text-sm text-foreground/70">{s.license}</p>
                <p className="mt-4 text-xs font-medium text-secondary group-hover:underline">
                  View requirements →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured rule example */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-1">
              <Badge variant="outline" className="mb-4">
                Example: NC LCMHCA
              </Badge>
              <h2 className="font-display text-3xl font-semibold text-foreground">
                Every rule shows its work.
              </h2>
              <p className="mt-4 text-foreground/70">
                Citation-linked, versioned, and audit-defensible. When a board
                updates a rule, we version it — your in-progress hours stay
                grandfathered under the rule you started under.
              </p>
            </div>
            <Card className="lg:col-span-2">
              <CardContent className="p-8">
                <p className="text-sm font-mono text-foreground/60 mb-3">
                  21 NCAC 53 · NC Board of Licensed Clinical Mental Health Counselors
                </p>
                <p className="text-foreground text-lg leading-relaxed">
                  1 hour of individual <em>or</em> 2 hours of group supervision
                  per{" "}
                  <span className="font-semibold">40 practice hours</span>. At
                  least <span className="font-semibold">75%</span> must be
                  individual. Group sessions capped at 12 attendees.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="label-overline mb-1">Required signers</p>
                    <p className="text-foreground">Supervisor + supervisee</p>
                  </div>
                  <div>
                    <p className="label-overline mb-1">Total hours required</p>
                    <p className="text-foreground">3,000 over 2–5 years</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
            Set up your roster. Get audit-ready today.
          </h2>
          <p className="mt-4 text-lg text-foreground/70 max-w-xl mx-auto">
            14-day free trial. No credit card. Supervisee accounts are free — always.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="https://app.audithalo.com/register">
                Start your supervisor account <ArrowRight />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
