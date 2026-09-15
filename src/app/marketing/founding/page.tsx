import {
  ShieldCheck,
  Scale,
  LayoutDashboard,
  Users,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FoundingApplyForm } from "./apply-form";

export const metadata = {
  title: "Founding Supervisor Program — AuditHalo",
  description:
    "Apply to join the first 15-25 supervisors shaping AuditHalo. 12 months of the Practice feature set free, 50% lifetime discount after, Founding Supervisor badge, and direct access to the founder.",
};

const offerLines = [
  "12 months of the Practice feature set, free — no credit card now, no auto-charge.",
  "50% lifetime discount that locks in when the free year ends.",
  "Founding Supervisor badge on your in-app dashboard.",
  "Direct line to the founder for the duration of the program.",
];

const askLines = [
  "Run a real roster — at least one pre-licensed supervisee, ideally three.",
  "Give honest feedback over a 30-minute call in the first 60 days.",
  "Post an honest review on Capterra / G2 / GetApp after ~45 days of use.",
  "Optional: a one-paragraph testimonial or a logo we can show.",
];

const pillars = [
  {
    icon: ShieldCheck,
    title: "Audit-defensible by default.",
    body: "Every signed session seals into a tamper-evident, SHA-256-hashed evidence package. Contemporaneous, citation-linked, independently verifiable.",
  },
  {
    icon: Scale,
    title: "The rules engine, kept current.",
    body: "Every hour evaluated against your state's exact admin code. Citation-linked. Versioned. Grandfathered when boards update requirements.",
  },
  {
    icon: LayoutDashboard,
    title: "One dashboard for the whole roster.",
    body: "At-risk flags 60 days before a deadline. Signature queue. Progress at a glance. Every supervisee in one view.",
  },
  {
    icon: Users,
    title: "Free for supervisees, always.",
    body: "Each supervisee gets a polished free account that tracks their own progress. They see exactly where they stand.",
  },
];

export default function FoundingPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-20 lg:py-28">
        <Badge variant="outline" className="mb-6">
          Founding Supervisor program · cohort 1
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-[color:var(--ink-900)] max-w-4xl leading-[1.05] tracking-tight">
          Help us build the supervision-compliance system you actually want.
        </h1>
        <p className="mt-6 text-lg text-[color:var(--ink-600)] max-w-2xl leading-relaxed">
          We&apos;re inviting the first 15-25 licensed supervisors in NC, CA, TX,
          FL, and NY into a 12-month Founding cohort. You get the Practice tier
          free for a year and a 50% lifetime discount after. We get your honest
          feedback on what supervision-compliance actually looks like inside a
          real practice — and the kind of social proof we can&apos;t buy.
        </p>
      </section>

      {/* Offer + ask side-by-side */}
      <section className="border-y border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
        <div className="mx-auto max-w-4xl px-6 py-16 lg:py-20 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6 sm:p-8">
            <p className="label-overline mb-4">What you get</p>
            <ul className="space-y-3">
              {offerLines.map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Check
                    className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--sage-500)]"
                    strokeWidth={2}
                  />
                  <span className="text-[color:var(--ink-700)] leading-relaxed">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6 sm:p-8">
            <p className="label-overline mb-4">What we ask</p>
            <ul className="space-y-3">
              {askLines.map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Check
                    className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--sage-500)]"
                    strokeWidth={2}
                  />
                  <span className="text-[color:var(--ink-700)] leading-relaxed">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-[color:var(--ink-500)] leading-relaxed">
              The review is for the act of writing one — not the sentiment. We
              never tie the reward to a positive review. That&apos;s a
              Capterra/G2 policy thing, and it&apos;s the right thing to do.
            </p>
          </div>
        </div>
      </section>

      {/* Why this matters — 4 pillars */}
      <section className="border-b border-[color:var(--ink-200)]">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <Badge variant="outline" className="mb-4">
            What you&apos;d be using
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[color:var(--ink-900)] max-w-2xl">
            Built around four things.
          </h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {pillars.map((p) => (
              <article
                key={p.title}
                className="flex flex-col gap-3 rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6 sm:p-8 transition-colors hover:border-[color:var(--ink-400)]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-[color:var(--paper-100)] text-[color:var(--ink-900)]">
                  <p.icon className="h-7 w-7" strokeWidth={2} />
                </div>
                <h3 className="font-display text-xl font-semibold text-[color:var(--ink-900)]">
                  {p.title}
                </h3>
                <p className="text-[color:var(--ink-600)] leading-relaxed">
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Apply form */}
      <section className="border-b border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
        <div className="mx-auto max-w-2xl px-6 py-16 lg:py-20">
          <Badge variant="outline" className="mb-4">
            Apply
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[color:var(--ink-900)]">
            Tell us about your roster.
          </h2>
          <p className="mt-3 text-[color:var(--ink-600)]">
            Three minutes. We read each application personally and reply
            within 48 hours.
          </p>
          <div className="mt-8">
            <Card className="rounded-[14px] border-[color:var(--ink-200)] bg-[color:var(--paper-white)]">
              <CardContent className="p-6 sm:p-8">
                <FoundingApplyForm />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Honest small-print */}
      <section>
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-[color:var(--ink-600)] leading-relaxed">
            We expect to fill cohort 1 in 4-6 weeks. If we don&apos;t reach you
            within 48 hours, the email got eaten somewhere — send a follow-up
            to{" "}
            <a
              href="mailto:info@audithalo.com"
              className="text-[color:var(--ink-700)] hover:text-[color:var(--ink-900)] underline"
            >
              info@audithalo.com
            </a>{" "}
            and we&apos;ll find it.
          </p>
        </div>
      </section>
    </>
  );
}
