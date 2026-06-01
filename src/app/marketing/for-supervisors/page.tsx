import Link from "next/link";
import {
  ShieldCheck,
  Clock,
  FileSignature,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "For Supervisors — AuditHalo",
  description:
    "Manage your entire supervisee roster's state-board compliance in one place. Never lose another supervisee's hours.",
};

const wins = [
  {
    icon: ShieldCheck,
    title: "You're the one the board calls.",
    body: "If a supervisee's hours are wrong, the board calls you. AuditHalo keeps your roster's hour totals continuously reconciled against the live state rule, with a citation-linked audit trail for every hour.",
  },
  {
    icon: Clock,
    title: "Stop being a spreadsheet janitor.",
    body: "One dashboard. Every supervisee. Live hour progress. At-risk flags two months before the deadline, not two weeks after.",
  },
  {
    icon: FileSignature,
    title: "Sign in two clicks, not two pages.",
    body: "Intent-confirmed e-signatures from your phone. Evidence package is generated, hashed, and locked in the same flow.",
  },
  {
    icon: TrendingUp,
    title: "Your supervisees get a real product.",
    body: "Their account is free and polished. They see their progress meter, get reminders, prep for full licensure. You don't have to convince them to use a new tool — they'll want to.",
  },
];

const objections = [
  {
    objection: "I already track hours in a spreadsheet.",
    response:
      "Spreadsheets don't grandfather you when the board changes a rule. They don't produce a hash-stamped evidence package. They don't flag a supervisee 60 days before their deadline. Spreadsheets are a tool you've outgrown.",
  },
  {
    objection: "My EHR already has supervisor co-signature.",
    response:
      "Co-signature on a clinical note is not an audit package for the state board. EHRs help you sign therapy notes. AuditHalo proves to the board that you supervised them.",
  },
  {
    objection: "Sounds expensive for a moonlighting supervisor.",
    response:
      "$89/month covers up to 3 supervisees. That's $30/supervisee. Each one is paying you $75–$150/hour for supervision. If AuditHalo saves you one hour of paperwork per supervisee per month, it pays for itself 3x over.",
  },
  {
    objection: "What about my supervisees in a state you don't support?",
    response:
      "We launched with NC, CA, TX, FL, and NY because that's where the volume is. Tell us your state — if you're an Enterprise customer or in our first 50, we'll prioritize encoding it.",
  },
];

export default function ForSupervisorsPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <Badge variant="outline" className="mb-6">
          For Supervisors
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground max-w-4xl leading-[1.05]">
          Manage your entire supervisee roster's compliance in one place.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl leading-relaxed">
          You signed up to grow clinicians, not run a spreadsheet. AuditHalo is
          the base of operations for licensed clinical supervisors — track
          every supervisee against the live state rule, sign in two clicks, and
          publish board-ready evidence packages without leaving the app.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href="https://app.audithalo.com/register">
              Start free trial <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">See pricing</Link>
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
                When a supervisee's audit goes wrong, the consequences land on
                the supervisor first.
              </h2>
              <p className="mt-2 text-foreground/70 max-w-3xl">
                In every state we cover, the supervisor signs attesting to
                hours. If those hours don't pass the board's review, the board
                doesn't just deny the supervisee — they can sanction your
                supervisor credential. AuditHalo exists to make sure that never
                happens.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Wins */}
      <section className="bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Why supervisors switch
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-2xl">
            Built around what your day actually looks like.
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

      {/* Objection handling */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            What we hear
          </Badge>
          <h2 className="font-display text-3xl font-semibold text-foreground">
            The honest answers.
          </h2>
          <div className="mt-10 space-y-8">
            {objections.map((o) => (
              <div key={o.objection}>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  "{o.objection}"
                </h3>
                <p className="mt-2 text-foreground/70">{o.response}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Try it on your real roster.
          </h2>
          <p className="mt-4 text-foreground/70">
            14 days, no card. Pull your supervisees in, plug their state rule in,
            see the dashboard fill up.
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
