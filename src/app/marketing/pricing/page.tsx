import Link from "next/link";
import { Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { jsonLdScript, pricingProductJsonLd } from "@/lib/seo";

export const metadata = {
  title: "Pricing — AuditHalo mental health supervision software",
  description:
    "Per-supervisee pricing for mental health supervision compliance. Supervisor and admin seats included. 14-day free trial. No credit card required.",
};

type Tier = {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: { label: string; href: string };
  highlighted?: boolean;
  features: { label: string; included: boolean }[];
  /** Optional pre-purchase warning block rendered under the features list.
   *  Currently used on Enterprise to flag the auto-promote-to-HR-Admin
   *  effect of upgrading. */
  notice?: string;
};

const tiers: Tier[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For solo supervisees tracking hours before audit.",
    cta: { label: "Start free", href: "https://app.audithalo.com/register" },
    features: [
      { label: "Manual hour log", included: true },
      { label: "1 supervisor connection", included: true },
      { label: "5 sessions/month", included: true },
      { label: "Basic progress dashboard", included: true },
      { label: "State rule engine", included: false },
      { label: "AI session notes", included: false },
      { label: "E-signatures", included: false },
      { label: "Evidence package PDF", included: false },
    ],
  },
  {
    name: "Solo Supervisor",
    price: "$89",
    period: "per month",
    description: "For a supervisor with up to 3 supervisees.",
    cta: { label: "Start 14-day trial", href: "https://app.audithalo.com/register?plan=solo" },
    highlighted: true,
    features: [
      { label: "Up to 3 supervisees", included: true },
      { label: "All 5 supported states (NC, CA, TX, FL, NY)", included: true },
      { label: "Supervisor dashboard", included: true },
      { label: "E-signature with intent confirmation", included: true },
      { label: "Audit-ready evidence package PDF", included: true },
      { label: "AI session notes (10 transcripts/mo)", included: true },
      { label: "Practice compliance heatmap", included: false },
      { label: "Multi-supervisor org (HR Admin role)", included: false },
    ],
  },
  {
    name: "Practice",
    price: "$25",
    period: "per supervisee per month",
    description: "For 4–20 supervisees who need practice-wide compliance visibility.",
    cta: { label: "Start 14-day trial", href: "https://app.audithalo.com/register?plan=practice" },
    features: [
      { label: "Everything in Solo Supervisor", included: true },
      { label: "Unlimited supervisees", included: true },
      { label: "Practice compliance heatmap", included: true },
      { label: "Bulk HRIS import (CSV)", included: true },
      { label: "Unlimited AI transcripts", included: true },
      { label: "Audit log retention (7 years)", included: true },
      { label: "Priority email support", included: true },
      { label: "Multi-supervisor org (HR Admin role)", included: false },
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "20+ supervisees",
    description: "For multi-supervisor practices and agencies with HR oversight.",
    cta: { label: "Talk to sales", href: "/contact?topic=enterprise" },
    features: [
      { label: "Everything in Practice", included: true },
      { label: "Multi-supervisor org (HR Admin + Supervisor + Executive roles)", included: true },
      { label: "Executive read-only dashboard", included: true },
      { label: "Audit log retention up to 20 years + CSV/JSON export", included: true },
      { label: "TOTP-gated sensitive actions", included: true },
      { label: "BAA (available on request)", included: true },
      { label: "Custom DPA (available on request)", included: true },
      { label: "Custom state-rule additions", included: true },
      { label: "Direct founder support line", included: true },
      // Honest roadmap markers — these are real plans but not shipped.
      // Surfacing as "Roadmap" keeps the pitch credible without overpromising.
      { label: "Roadmap: SOC 2 Type 2 report", included: false },
      { label: "Roadmap: SSO / SAML", included: false },
      { label: "Roadmap: MS Teams transcript ingestion", included: false },
      { label: "Roadmap: Merge.dev HRIS sync (live, not just CSV)", included: false },
      { label: "Roadmap: Read/write API", included: false },
    ],
    // Pre-purchase warning surfaced inline on the Enterprise tier card so
    // the supervisor understands the role flip happens automatically when
    // they buy. See docs/strategy/04-enterprise-rbac.md "Provisioning
    // workflows → Practice → Enterprise upgrade" for the full rationale.
    notice:
      "Upgrading promotes your current account to HR Admin. HR Admin manages billing, team, and org settings — but doesn't sign supervision sessions. If you also supervise clinically, create a second Supervisor account with a different email and invite it into the org after upgrading.",
  },
];

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(pricingProductJsonLd())}
      />
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <Badge variant="outline" className="mb-4">
          Pricing
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground max-w-3xl">
          Priced per supervisee. Everyone else is free.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl">
          The supervisor is the one with board liability. So they're the buyer.
          The supervisee is the one with the audit on the line. So their account
          is free, always. Pay only for the seats that need the full compliance
          stack.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground/60">
          <span>14-day free trial · No credit card</span>
          <span className="hidden sm:inline">·</span>
          <span>Annual = 2 months free</span>
          <span className="hidden sm:inline">·</span>
          <span>Cancel anytime</span>
        </div>
      </section>

      {/* Tiers */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`p-8 flex flex-col bg-card ${tier.highlighted ? "ring-2 ring-secondary ring-inset" : ""}`}
              >
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    {tier.name}
                  </h2>
                  {tier.highlighted && (
                    <Badge variant="secondary">Most popular</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-foreground/60 min-h-10">
                  {tier.description}
                </p>
                <div className="mt-6">
                  <span className="font-display text-4xl font-bold text-foreground">
                    {tier.price}
                  </span>
                  <span className="ml-2 text-sm text-foreground/60">
                    {tier.period}
                  </span>
                </div>
                <Button
                  asChild
                  variant={tier.highlighted ? "default" : "outline"}
                  className="mt-6"
                >
                  <a href={tier.cta.href}>
                    {tier.cta.label}
                  </a>
                </Button>
                <ul className="mt-8 space-y-3 text-sm">
                  {tier.features.map((f) => (
                    <li
                      key={f.label}
                      className={`flex items-start gap-2 ${f.included ? "text-foreground" : "text-foreground/40"}`}
                    >
                      {f.included ? (
                        <Check
                          className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]"
                          strokeWidth={2.5}
                        />
                      ) : (
                        <X
                          className="h-4 w-4 mt-0.5 shrink-0 text-foreground/30"
                          strokeWidth={2}
                        />
                      )}
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>
                {"notice" in tier && tier.notice && (
                  <div className="mt-6 p-3 rounded-sm border-l-[3px] border-[color:var(--color-warning)] bg-[color:var(--color-warning)]/5 text-xs text-foreground/80 leading-relaxed">
                    <strong>Heads up:</strong> {tier.notice}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
          <Badge variant="outline" className="mb-4">
            Pricing FAQ
          </Badge>
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Honest answers.
          </h2>
          <div className="mt-10 space-y-8">
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                Why is the supervisee account free?
              </h3>
              <p className="mt-2 text-foreground/70">
                Two reasons. First, supervisees rarely have a budget — they're
                paying for supervision out of pocket already. Second, today's
                free supervisee is tomorrow's licensed supervisor. We'd rather
                meet you early.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                What counts as a "seat"?
              </h3>
              <p className="mt-2 text-foreground/70">
                One seat = one supervisee on a supervisor's roster. Add a new
                supervisee, add a seat. Drop one, drop a seat. We prorate to the
                hour.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                What if my state isn't supported yet?
              </h3>
              <p className="mt-2 text-foreground/70">
                We launched with NC, CA, TX, FL, and NY because they cover most
                of the US associate population. Tell us your state and we'll
                prioritize. Enterprise customers get custom state additions in
                contract.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                How is my data protected?
              </h3>
              <p className="mt-2 text-foreground/70">
                Supervision records are encrypted in transit and at rest.
                Evidence packages are SHA-256 hashed at sealing — independently
                verifiable. Supervision notes document the supervisory
                relationship, not client records.{" "}
                <Link
                  href="/security"
                  className="text-secondary hover:underline"
                >
                  See our security details →
                </Link>
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                Can I switch tiers later?
              </h3>
              <p className="mt-2 text-foreground/70">
                Yes — instantly, both directions, prorated. Your data stays
                intact. Your evidence packages stay valid (they're hashed and
                immutable regardless of plan).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            See it on your own roster.
          </h2>
          <p className="mt-4 text-foreground/70">
            14 days. Real state-rule engine. Full audit package. No card.
          </p>
          <Button asChild size="lg" className="mt-8">
            <a href="https://app.audithalo.com/register">
              Start free trial <ArrowRight />
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
