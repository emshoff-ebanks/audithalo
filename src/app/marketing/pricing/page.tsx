import Link from "next/link";
import { Mail, ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/marketing/contact-form";

// Pricing is intentionally held back while we finalize tiers. Every
// inbound /pricing link across the marketing site still resolves — the URL
// didn't change — but instead of advertising specific dollar amounts that
// aren't locked yet, the page invites the visitor to a conversation.
// Previous tier content lives in git history; restore when pricing is locked.
// jsonLd structured pricing + per-tier tables were intentionally omitted so
// stale numbers don't get indexed.

export const metadata = {
  title: "Pricing — AuditHalo mental health supervision software",
  description:
    "AuditHalo pricing is set per practice and per team size. Tell us about your supervisors and supervisees — we'll send a tailored quote, usually same day.",
};

const discussPoints = [
  "Team size — supervisors + supervisees",
  "States your clinicians practice in",
  "HRIS / payroll integration needs",
  "Audit-log retention requirements",
  "Custom state-rule additions, if needed",
  "BAA / DPA if your compliance team requires",
];

export default function PricingPage() {
  return (
    <>
      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-6xl px-6 py-14 lg:py-20">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-[color:var(--ink-600)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--halo-yellow)] shadow-[0_0_0_3px_rgba(255,214,10,0.22)]" />
          Pricing
        </span>
        <h1 className="max-w-3xl font-display text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight text-[color:var(--ink-900)]">
          Pricing built around your practice.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--ink-600)]">
          We&apos;re finalizing our pricing tiers as we onboard our first cohort
          of supervisors and group practices. In the meantime, tell us about
          your team and we&apos;ll send a quote that fits — usually the same
          business day.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[color:var(--ink-500)]">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--ok-700)]" />
            14-day free trial · No credit card to start
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--ok-700)]" />
            Quote within 1 business day
          </span>
        </div>
      </section>

      {/* ==================== QUOTE FORM + SIDEBAR ==================== */}
      <section className="border-t border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Get a tailored quote
          </Badge>
          <h2 className="max-w-2xl font-display text-3xl sm:text-4xl font-semibold text-[color:var(--ink-900)]">
            Tell us about your team.
          </h2>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            {/* Form panel */}
            <div className="lg:col-span-2">
              <div className="rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6 sm:p-8">
                <p className="mb-8 max-w-xl text-sm leading-relaxed text-[color:var(--ink-600)]">
                  In your message, include how many supervisors and supervisees
                  are on your team, which states they practice in, and whether
                  you need HRIS integration. We&apos;ll come back with a quote
                  and a 14-day trial set up for your account.
                </p>
                <ContactForm />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              <div className="rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6">
                <h3 className="mb-3 font-display text-base font-semibold text-[color:var(--ink-900)]">
                  Or reach us directly
                </h3>
                <div className="flex items-start gap-2.5 text-sm">
                  <Mail
                    className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--ink-900)]"
                    strokeWidth={2}
                  />
                  <div>
                    <a
                      href="mailto:info@audithalo.com"
                      className="border-b-[1.5px] border-[color:var(--halo-yellow)] pb-0.5 font-mono text-sm text-[color:var(--ink-900)] transition-colors hover:border-[color:var(--ink-900)]"
                    >
                      info@audithalo.com
                    </a>
                    <p className="mt-2 text-xs text-[color:var(--ink-500)]">
                      A real human answers — typically same day.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6">
                <h3 className="mb-4 font-display text-base font-semibold text-[color:var(--ink-900)]">
                  What we&apos;ll discuss
                </h3>
                <ul className="grid gap-3 text-sm">
                  {discussPoints.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 text-[color:var(--ink-700)]"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--sage-500)]"
                        strokeWidth={2.5}
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6">
                <h3 className="mb-3 font-display text-base font-semibold text-[color:var(--ink-900)]">
                  Already trialing?
                </h3>
                <p className="text-sm leading-relaxed text-[color:var(--ink-600)]">
                  Existing customers can manage billing from inside the app —{" "}
                  <a
                    href="https://app.audithalo.com/dashboard/billing"
                    className="text-[color:var(--ink-900)] underline decoration-[color:var(--halo-yellow)] decoration-[1.5px] underline-offset-2 hover:decoration-[color:var(--ink-900)]"
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

      {/* ====================== FOOTER CTA BAND ====================== */}
      <section className="border-t border-[color:var(--ink-200)] bg-[color:var(--halo-yellow)]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-bold leading-tight tracking-tight text-[color:var(--ink-900)]">
            Want to try it first?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[color:rgba(14,14,12,0.75)]">
            Start a free 14-day trial — no credit card. Pricing locks in only
            after you&apos;ve seen how it fits your practice.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-[color:var(--ink-900)] text-[color:var(--halo-yellow)] hover:bg-[color:var(--ink-800)] hover:text-[color:var(--halo-yellow)]"
            >
              <a href="https://app.audithalo.com/register">
                Start free trial <ArrowRight />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-[color:var(--ink-900)] text-[color:var(--ink-900)] hover:bg-[color:rgba(14,14,12,0.06)] hover:border-[color:var(--ink-900)]"
            >
              <Link href="/features">See the product</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
