import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/marketing/contact-form";

// Pricing is intentionally held back while we finalize tiers. Every
// inbound /pricing link across the marketing site (top nav, mobile nav,
// for-supervisors CTA, for-group-practices CTA, evidence-packages CTA,
// homepage CTA, etc.) still resolves — the URL didn't change — but
// instead of advertising specific dollar amounts that aren't locked
// yet, the page invites the visitor to a conversation. Previous tier
// content lives in git history (commit before this one); restore from
// there when pricing is locked.
//
// Intentionally omitted versus the old page:
//   - jsonLd structured pricing data (was emitting tier prices to
//     search engines — don't want stale numbers indexed)
//   - per-tier feature tables (will return when pricing is set)

export const metadata = {
  title: "Pricing — AuditHalo mental health supervision software",
  description:
    "AuditHalo pricing is set per practice and per team size. Tell us about your supervisors and supervisees — we'll send a tailored quote, usually same day.",
};

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <Badge variant="outline" className="mb-4">
          Pricing
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground max-w-3xl">
          Pricing built around your practice.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl">
          We&apos;re finalizing our pricing tiers as we onboard our first cohort
          of supervisors and group practices. In the meantime, tell us about
          your team and we&apos;ll send a quote that fits — usually the same
          business day.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground/60">
          <span>14-day free trial · No credit card to start</span>
          <span className="hidden sm:inline">·</span>
          <span>Quote within 1 business day</span>
        </div>
      </section>

      {/* Contact form + sidebar */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
            <div className="lg:col-span-2">
              <h2 className="font-display text-2xl font-semibold text-foreground mb-3">
                Get a tailored quote
              </h2>
              <p className="text-foreground/70 text-sm mb-8 max-w-xl">
                In your message, include how many supervisors and supervisees
                are on your team, which states they practice in, and whether
                you need HRIS integration. We&apos;ll come back with a quote
                and a 14-day trial set up for your account.
              </p>
              <ContactForm />
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              <div>
                <h3 className="font-display text-base font-semibold text-foreground mb-3">
                  Or reach us directly
                </h3>
                <div className="flex items-start gap-2.5 text-sm">
                  <Mail
                    className="h-4 w-4 mt-0.5 shrink-0 text-secondary"
                    strokeWidth={1.75}
                  />
                  <div>
                    <a
                      href="mailto:info@audithalo.com"
                      className="text-secondary hover:underline"
                    >
                      info@audithalo.com
                    </a>
                    <p className="mt-1 text-xs text-foreground/60">
                      A real human answers — typically same day.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-8">
                <h3 className="font-display text-base font-semibold text-foreground mb-3">
                  What we&apos;ll discuss
                </h3>
                <ul className="space-y-2 text-sm text-foreground/70">
                  <li>Team size — supervisors + supervisees</li>
                  <li>States your clinicians practice in</li>
                  <li>HRIS / payroll integration needs</li>
                  <li>Audit-log retention requirements</li>
                  <li>Custom state-rule additions, if needed</li>
                  <li>BAA / DPA if your compliance team requires</li>
                </ul>
              </div>

              <div className="border-t border-border pt-8">
                <h3 className="font-display text-base font-semibold text-foreground mb-3">
                  Already trialing?
                </h3>
                <p className="text-sm text-foreground/70">
                  Existing customers can manage billing from inside the app —{" "}
                  <a
                    href="https://app.audithalo.com/dashboard/billing"
                    className="text-secondary hover:underline"
                  >
                    Account &amp; billing
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Want to try it first?
          </h2>
          <p className="mt-4 text-foreground/70">
            Start a free 14-day trial — no credit card. Pricing locks in only
            after you&apos;ve seen how it fits your practice.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <a href="https://app.audithalo.com/register">
                Start free trial <ArrowRight />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/features">See the product</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
