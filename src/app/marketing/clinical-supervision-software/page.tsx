import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  FileSignature,
  Clock,
  Users,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FaqSection } from "@/components/marketing/faq-section";
import { articleJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/seo";

const URL = "https://audithalo.com/clinical-supervision-software";

export const metadata = {
  title:
    "Clinical supervision software for mental health supervisors | AuditHalo",
  description:
    "Clinical supervision software built for licensed mental health supervisors. Track every supervised hour against state-board rules, capture intent-confirmed e-signatures, and seal audit-ready evidence packages — without spreadsheets.",
  alternates: { canonical: URL },
};

const FAQ = [
  {
    q: "What is clinical supervision software?",
    a: "Clinical supervision software helps licensed supervisors track pre-licensed counselors' supervised practice hours against state-board requirements, capture electronic signatures with intent confirmation, and generate audit-ready evidence packages. The best tools — like AuditHalo — encode each state's exact supervision rule, version it when the board updates the rule, and produce a SHA-256-hashed PDF you can hand directly to a state board.",
  },
  {
    q: "Who uses clinical supervision software?",
    a: "Licensed clinical supervisors (LCMHCS, LPC-S, LCSW-S, Qualified Supervisors, etc.) who oversee pre-licensed mental health counselors working toward independent licensure. Group practice owners, HR directors, and clinical directors use it for practice-wide visibility into supervision compliance.",
  },
  {
    q: "Why use specialized software instead of a spreadsheet?",
    a: "Spreadsheets don't encode state-board rules. They don't version when the board updates. They don't capture intent-confirmed e-signatures. They don't hash and timestamp evidence so it survives an audit. They don't flag at-risk supervisees 60 days before a deadline. AuditHalo does all of these automatically — supervisors who switch from spreadsheets typically reclaim 2–4 hours per supervisee per month.",
  },
  {
    q: "Which states does AuditHalo cover?",
    a: "North Carolina (LCMHCA), California (APCC), Texas (LPC-A), Florida (RMHCI), and New York (LP-MHC) at launch. Each rule is citation-linked to the state administrative code and re-verified quarterly. Additional states are added based on customer demand.",
  },
  {
    q: "How do evidence packages work?",
    a: "Every time a supervision session is fully signed (supervisor + supervisee both confirm intent), AuditHalo seals the session into a PDF — every signed hour, every credential check, hashed and timestamped. The package includes a public verify-URL anyone (board, employer, auditor) can paste into a browser to confirm the document hasn't been altered.",
  },
];

export default function ClinicalSupervisionSoftwarePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          articleJsonLd({
            headline:
              "Clinical supervision software for mental health supervisors",
            description: metadata.description!,
            url: URL,
            datePublished: "2026-06-04",
          })
        )}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(faqPageJsonLd(FAQ))}
      />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <Badge variant="outline" className="mb-6">
          Clinical supervision software
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground max-w-4xl leading-[1.05]">
          Clinical supervision software for mental health supervisors.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-3xl leading-relaxed">
          AuditHalo is the supervision compliance system built for the licensed
          supervisors who carry board liability. Track every supervised hour
          against your state-board rule, capture intent-confirmed e-signatures,
          and seal audit-ready evidence packages — without a single spreadsheet.
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
            5 states encoded at launch
          </span>
        </div>
      </section>

      {/* Why clinical supervision software is its own category */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            What general-purpose tools miss
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-3xl">
            Spreadsheets don&apos;t encode statutes.
          </h2>
          <p className="mt-4 text-foreground/70 max-w-3xl leading-relaxed">
            A clinical supervision workflow has unusual rules. Every supervised
            hour has to count against an exact statute (NC 21 NCAC 53 §0210,
            CA 16 CCR §1820, etc.) with its own cadence, ratio, credential, and
            evidence requirements. The rule can change between when a
            supervisee starts and when they finish. The board can ask, years
            later, for a supervision record that nobody on staff actually wrote
            down at the time. Generic project management tools miss every part
            of this.
          </p>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            <Feature
              Icon={ShieldCheck}
              title="State-board rules encoded"
              body="Every supervised hour is evaluated against the exact statute. When the board updates the rule, AuditHalo versions it; in-progress hours stay grandfathered."
            />
            <Feature
              Icon={Clock}
              title="60-day at-risk flags"
              body="Predicts who will miss their hours or ratios before the audit, not after. Catch the gap when you can still fix it."
            />
            <Feature
              Icon={FileSignature}
              title="Intent-confirmed e-signatures"
              body="Supervisor and supervisee both confirm intent. Each signature is timestamped, attributed, and immutable."
            />
            <Feature
              Icon={Users}
              title="Per-supervisee pricing"
              body="Supervisor and admin seats are included. Pay only for the supervisees who use the full compliance stack."
            />
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
            Five states. Citation-linked. Quarterly verified.
          </h2>
          <p className="mt-3 text-foreground/70 max-w-2xl">
            Each rule cites the state administrative code, includes the
            supervisor-credential requirement, the practice-to-supervision
            ratio, and the hour totals. New states ship based on customer demand.
          </p>
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border">
            {[
              { code: "NC", license: "LCMHCA", href: "/states/nc-lcmhca" },
              { code: "CA", license: "APCC", href: "/states/ca-apcc" },
              { code: "TX", license: "LPC-A", href: "/states/tx-lpc-associate" },
              { code: "FL", license: "RMHCI", href: "/states/fl-rmhci" },
              { code: "NY", license: "LP-MHC", href: "/states/ny-lmhc-lp" },
            ].map((s) => (
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

      <FaqSection items={FAQ} />

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
            Get clinical supervision audit-ready today.
          </h2>
          <p className="mt-4 text-lg text-foreground/70 max-w-2xl mx-auto">
            14-day free trial. No credit card. Supervisee accounts are free —
            always.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="https://app.audithalo.com/register">
                Start your supervisor account <ArrowRight />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/evidence-packages">How evidence packages work</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function Feature({
  Icon,
  title,
  body,
}: {
  Icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <Card className="rounded-none border-0">
      <CardContent className="p-8">
        <Icon className="h-6 w-6 text-secondary" strokeWidth={1.75} />
        <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-foreground/70 leading-relaxed">{body}</p>
      </CardContent>
    </Card>
  );
}
