import Link from "next/link";
import { ArrowRight, ShieldCheck, MapPin } from "lucide-react";
import { listLatestRules, ruleSlug } from "@/lib/rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Supported states — AuditHalo",
  description:
    "Encoded state-board supervision rules for clinical mental-health counselor associates across NC, CA, TX, FL, NY, AZ, DE, OH, LA, and WA. Citation-linked and quarterly verified.",
};

export default function StatesIndexPage() {
  const rules = listLatestRules();

  return (
    <>
      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <Badge variant="outline" className="mb-4">
          Supported states
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-[color:var(--ink-900)] max-w-3xl leading-[1.05] tracking-tight">
          Compliance, encoded, citation-grounded.
        </h1>
        <p className="mt-6 text-lg text-[color:var(--ink-600)] max-w-2xl leading-relaxed">
          Each state&apos;s supervision rule is encoded from its administrative code and
          re-verified on a published schedule. Click into any state to see hour
          requirements, cadence rules, supervisor qualifications, and the citation
          link to the live source.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[color:var(--ink-500)]">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[color:var(--sage-500)]" strokeWidth={2} />
            Citation-linked to the administrative code
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[color:var(--sage-500)]" strokeWidth={2} />
            Versioned per board, re-verified quarterly
          </span>
        </div>
      </section>

      {/* ============================ GRID ============================ */}
      <section className="border-t border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <Badge variant="outline" className="mb-4">
                Encoded boards
              </Badge>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[color:var(--ink-900)]">
                Your board, versioned.
              </h2>
              <p className="mt-3 text-[color:var(--ink-600)]">
                Every rule citation-linked to the state administrative code and
                re-verified on schedule. Don&apos;t see your board? Tell us and
                we&apos;ll add it.
              </p>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link href="/contact">
                Request a new state <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {rules.map((r) => {
              const slug = ruleSlug(r.jurisdiction, r.license_code);
              return (
                <Link
                  key={slug}
                  href={`/states/${slug}`}
                  className="group flex flex-col gap-1 rounded-[10px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-4 transition-all hover:-translate-y-0.5 hover:border-[color:var(--ink-900)]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-4xl font-bold leading-none tracking-tight text-[color:var(--ink-900)]">
                      {r.jurisdiction}
                    </span>
                    <span className="font-mono text-[0.6875rem] text-[color:var(--ink-500)]">
                      v{r.version}
                    </span>
                  </div>
                  <span className="mt-2 border-t border-[color:var(--ink-100)] pt-2 font-mono text-xs font-semibold text-[color:var(--ink-800)]">
                    {r.license_code}
                  </span>
                  <span className="text-[0.6875rem] text-[color:var(--ink-500)] leading-snug">
                    {r.license_name}
                  </span>
                  <span className="mt-2 font-mono text-[0.6875rem] text-[color:var(--ink-500)] group-hover:text-[color:var(--ink-700)]">
                    View requirements →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================= CLOSING CTA ========================= */}
      <section className="border-t border-[color:var(--ink-200)]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl font-semibold text-[color:var(--ink-900)]">
            Your state isn&apos;t here yet?
          </h2>
          <p className="mt-4 text-[color:var(--ink-600)] leading-relaxed">
            Tell us and we&apos;ll prioritize encoding it. Enterprise customers get custom
            state additions in contract.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/contact">
                Request a new state <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="mailto:info@audithalo.com?subject=State%20rule%20request">
                Email us directly
              </a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
