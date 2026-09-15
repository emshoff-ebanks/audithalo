import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listLatestRules, ruleSlug } from "@/lib/rules";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <Badge variant="outline" className="mb-4">
          Supported states
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground max-w-3xl">
          Compliance, encoded, citation-grounded.
        </h1>
        <p className="mt-6 text-lg text-[color:var(--ink-600)] max-w-2xl">
          Each state&apos;s supervision rule is encoded from its administrative code and
          re-verified on a published schedule. Click into any state to see hour
          requirements, cadence rules, supervisor qualifications, and the citation
          link to the live source.
        </p>
      </section>

      <section className="border-t border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[color:var(--ink-200)]">
            {rules.map((r) => {
              const slug = ruleSlug(r.jurisdiction, r.license_code);
              return (
                <Link
                  key={slug}
                  href={`/states/${slug}`}
                  className="bg-[color:var(--paper-white)] p-8 hover:bg-accent transition-colors group"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-display text-4xl font-bold text-foreground">
                      {r.jurisdiction}
                    </p>
                    <p className="font-mono text-xs text-[color:var(--ink-500)]">
                      v{r.version}
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {r.license_code}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--ink-500)] leading-snug">
                    {r.license_name}
                  </p>
                  <p className="mt-6 text-xs font-medium text-[color:var(--ink-700)] group-hover:underline">
                    View rule →
                  </p>
                </Link>
              );
            })}
          </div>
          <div className="mt-10 flex justify-center">
            <Button asChild size="lg">
              <Link href="/contact">
                Request a new state <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-[color:var(--ink-200)]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Your state isn&apos;t here yet?
          </h2>
          <p className="mt-4 text-[color:var(--ink-600)]">
            Tell us and we&apos;ll prioritize encoding it. Enterprise customers get custom
            state additions in contract.
          </p>
          <Button asChild size="lg" variant="outline" className="mt-8">
            <a href="mailto:info@audithalo.com?subject=State%20rule%20request">
              Request a state <ArrowRight />
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
