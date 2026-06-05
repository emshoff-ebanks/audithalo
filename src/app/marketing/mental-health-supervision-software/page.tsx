import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Brain,
  Users,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FaqSection } from "@/components/marketing/faq-section";
import { articleJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/seo";

const URL = "https://audithalo.com/mental-health-supervision-software";

export const metadata = {
  title:
    "Mental health supervision software for LCMHCA, APCC, LPC-A, RMHCI, LP-MHC | AuditHalo",
  description:
    "Mental health supervision software for pre-licensed counselor associates. Track hours, capture e-signatures, and seal evidence packages against your exact state-board rule — NC, CA, TX, FL, NY.",
  alternates: { canonical: URL },
};

const FAQ = [
  {
    q: "What is mental health supervision software?",
    a: "Mental health supervision software helps pre-licensed counselor associates (LCMHCA, APCC, LPC-A, RMHCI, LP-MHC) and their supervisors track supervised practice hours against state-board licensure rules. The best tools encode each state's exact statute, capture intent-confirmed e-signatures from both signers, and generate sealed PDF evidence packages that survive a state-board audit.",
  },
  {
    q: "Which mental-health credentials does AuditHalo support?",
    a: "LCMHCA (North Carolina), APCC (California), LPC-A (Texas), RMHCI (Florida), and LP-MHC (New York) at launch — covering the majority of pre-licensed mental-health counselors in the US. Each rule is citation-linked to the state administrative code and quarterly re-verified.",
  },
  {
    q: "How is this different from EHR or practice-management software?",
    a: "EHR systems track patient encounters; practice-management systems track scheduling and billing. Neither tracks the supervisor-supervisee relationship against a state-board rule, generates intent-confirmed e-signatures with audit hashes, or surfaces at-risk supervisees 60 days before a deadline. AuditHalo is purpose-built for the supervision-compliance layer that sits adjacent to clinical practice.",
  },
  {
    q: "Are supervisee accounts free?",
    a: "Yes — always. The supervisor carries board liability and is the buyer. Supervisee accounts are free forever; they see their own hour progress, sign sessions with intent, and carry a copy of every evidence package.",
  },
  {
    q: "What happens when a state board updates a rule?",
    a: "AuditHalo versions the rule. A supervisee who started under v1 stays under v1 even when v2 ships — their hours remain valid. New supervisees join under the latest version. Evidence packages always cite the rule version they were sealed under, so the board can interpret the documentation under the rule that was in effect at the time.",
  },
];

export default function MentalHealthSupervisionSoftwarePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          articleJsonLd({
            headline:
              "Mental health supervision software for pre-licensed counselor associates",
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
          Mental health supervision software
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground max-w-4xl leading-[1.05]">
          Mental health supervision software, built for the supervisor.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-3xl leading-relaxed">
          AuditHalo tracks every supervised hour your LCMHCA, APCC, LPC-A,
          RMHCI, or LP-MHC supervisee logs — against the exact state-board
          rule, with intent-confirmed e-signatures and SHA-256-hashed evidence
          packages. Audit-ready from day one.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href="https://app.audithalo.com/register">
              Start your supervisor account <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/for-supervisors">How it works</Link>
          </Button>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground/60">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
            14-day free trial
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
            Supervisee accounts always free
          </span>
        </div>
      </section>

      {/* Built around mental-health rules */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Built around the rules
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-3xl">
            Every mental-health supervision rule, encoded.
          </h2>
          <p className="mt-4 text-foreground/70 max-w-3xl leading-relaxed">
            Mental-health licensing boards specify <em>exactly</em> what counts
            as supervised practice: the supervisor&apos;s credential, the
            session type, the cadence, the supervision-to-practice ratio, the
            attendee cap on group sessions. AuditHalo encodes each of these per
            state and runs every logged hour against the live rule.
          </p>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            <Feature
              Icon={Brain}
              title="Supervisee-centric"
              body="Counselor associates see their own dashboard, log their own practice hours, and sign with intent. Their account is free, always."
            />
            <Feature
              Icon={ShieldCheck}
              title="Supervisor-credential checks"
              body="Every supervision session validates the supervisor's credential against the state-board requirement at the moment of signing."
            />
            <Feature
              Icon={Sparkles}
              title="AI-assisted notes"
              body="Drop in a supervision transcript; get a structured session note. Topics covered, competencies addressed, supervisor feedback, next steps."
            />
            <Feature
              Icon={Users}
              title="Practice-wide visibility"
              body="At 5+ supervisees the dashboard surfaces a practice compliance score and risk-distribution heatmap. Catch the gap before the audit."
            />
          </div>
        </div>
      </section>

      <FaqSection items={FAQ} />

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
            Get your mental-health supervision audit-ready today.
          </h2>
          <p className="mt-4 text-lg text-foreground/70 max-w-2xl mx-auto">
            14-day free trial. No credit card. Supervisee accounts always free.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="https://app.audithalo.com/register">
                Start your supervisor account <ArrowRight />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/states">Browse state rules</Link>
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
