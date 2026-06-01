import Link from "next/link";
import {
  ShieldCheck,
  FileSignature,
  Sparkles,
  BarChart3,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: ShieldCheck,
    title: "Multi-state rules engine",
    body: "Encode supervision requirements per state and license type. NC LCMHCA, CA APCC, TX LPC-A, FL RMHCI, NY limited permit — supported out of the box.",
  },
  {
    icon: Sparkles,
    title: "AI-written session notes",
    body: "Drop in a Teams transcript with PHI pre-scan. Get a structured supervision note your supervisor can sign in two minutes instead of thirty.",
  },
  {
    icon: FileSignature,
    title: "Tamper-evident e-signatures",
    body: "Supervisor and supervisee sign with intent confirmation. Evidence packages are SHA-256 hashed and immutable — the same proof your state board would build.",
  },
  {
    icon: BarChart3,
    title: "Role-based dashboards",
    body: "Supervisees see hour progress at a glance. Supervisors manage rosters. HR sees compliance heatmaps. Executives see risk.",
  },
];

const states = [
  { code: "NC", license: "LCMHCA", href: "/states/nc-lcmhca" },
  { code: "CA", license: "APCC", href: "/states/ca-apcc" },
  { code: "TX", license: "LPC-A", href: "/states/tx-lpc-associate" },
  { code: "FL", license: "RMHCI", href: "/states/fl-rmhci" },
  { code: "NY", license: "LP-MHC", href: "/states/ny-permit" },
];

export default function MarketingHome() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <Badge variant="outline" className="mb-6">
          Clinical supervision compliance
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground max-w-3xl leading-[1.05]">
          The audit-ready command center for licensed counselors and their
          supervisors.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl leading-relaxed">
          Track supervision hours against state board rules. Generate AI session
          notes from Teams transcripts. Capture intent-confirmed e-signatures.
          Publish tamper-evident evidence packages — without a single
          spreadsheet.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href="https://app.audithalo.com/register">
              Start free trial <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/features">See how it works</Link>
          </Button>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground/60">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
            14-day free trial
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
            No credit card
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
            Supervisees always free
          </span>
        </div>
      </section>

      {/* Features grid */}
      <section
        id="features"
        className="border-t border-border bg-card"
      >
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            What you get
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-2xl">
            Built for the four roles that touch every supervision hour.
          </h2>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
            {features.map((f) => (
              <div key={f.title} className="bg-card p-8">
                <f.icon
                  className="h-6 w-6 text-secondary"
                  strokeWidth={1.75}
                />
                <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-foreground/70 leading-relaxed">
                  {f.body}
                </p>
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
            Compliance, encoded.
          </h2>
          <p className="mt-3 text-foreground/70 max-w-2xl">
            Five states at launch, more on the way. Every rule is citation-linked
            to the state administrative code and re-verified quarterly.
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
                  View rule →
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
                changes the rule, we version it — your in-flight hours stay
                grandfathered under the rule you started under.
              </p>
            </div>
            <Card className="lg:col-span-2">
              <CardContent className="p-8">
                <p className="text-sm font-mono text-foreground/60 mb-3">
                  21 NCAC 53 · Rule shape: ratio
                </p>
                <p className="text-foreground text-lg leading-relaxed">
                  1 hour of individual <em>or</em> 2 hours of group supervision
                  per{" "}
                  <span className="font-semibold">40 practice hours</span>. At
                  least <span className="font-semibold">75%</span> must be
                  individual. Group sessions max 12 attendees.
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
            Get your roster audit-ready in an afternoon.
          </h2>
          <p className="mt-4 text-lg text-foreground/70 max-w-xl mx-auto">
            14-day free trial. No credit card. Your supervisees stay free
            forever.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="https://app.audithalo.com/register">
                Start free trial <ArrowRight />
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
