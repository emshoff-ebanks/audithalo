import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  FileSignature,
  Hash,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SealMedallion } from "@/components/marketing/seal-medallion";

export const metadata = {
  title:
    "Evidence packages — sealed mental health supervision records for state board audits | AuditHalo",
  description:
    "When your supervisee finishes their hours, AuditHalo seals every signed session into a SHA-256-hashed PDF. Hand it to the board exactly as-is — independently verifiable, immutable, audit-ready.",
  alternates: { canonical: "https://audithalo.com/evidence-packages" },
};

export default function EvidencePackagesPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-8 items-center">
          <div className="max-w-xl">
            <Badge variant="outline" className="mb-6">
              The proof-moment in your dashboard
            </Badge>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-[color:var(--ink-900)] max-w-4xl leading-[1.05] tracking-tight">
              Evidence the board can&apos;t question.
            </h1>
            <p className="mt-6 text-lg text-[color:var(--ink-600)] leading-relaxed">
              When your mental health supervisee finishes their hours, AuditHalo
              seals every signed session into a single PDF — citation-linked, SHA-256
              hashed, timestamped at the moment of signing. Hand it to the board
              exactly as-is. They never call you back asking &quot;do you have proof
              of…&quot;.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <a href="https://app.audithalo.com/register">
                  Start your supervisor account <ArrowRight />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/for-supervisors">See how it works</Link>
              </Button>
            </div>
          </div>

          {/* Sealed evidence card (illustrative sample) */}
          <div className="relative rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-5 shadow-[0_24px_60px_-30px_rgba(14,14,12,0.25)]">
            <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[14px] bg-[color:var(--seal-gold)]" />
            <div className="mb-4 flex items-start gap-4">
              <SealMedallion />
              <div>
                <div className="label-overline">Evidence Package · Sealed</div>
                <div className="mt-1 font-display text-xl font-bold leading-tight text-[color:var(--ink-900)]">
                  Individual Supervision · Ava Villareal
                </div>
                <div className="mt-1 font-mono text-xs text-[color:var(--ink-500)]">
                  EVD-2026-0916 · Sealed Sep 16, 14:07 EDT
                </div>
              </div>
            </div>
            <div className="mb-4 rounded-md border border-[color:var(--ink-100)] bg-[color:var(--paper-100)] px-3.5 py-3">
              <div className="font-mono text-[0.625rem] uppercase tracking-wider text-[color:var(--seal-gold)]">
                sha-256
              </div>
              <code className="mt-1 block break-all font-mono text-xs leading-relaxed text-[color:var(--ink-700)]">
                9f2c1a7d4e8b6f2a83c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4a47e
              </code>
            </div>
            <ul className="mb-4 grid gap-2.5">
              {[
                ["Supervisor", "Jillian Steyl · NC LCMHCS"],
                ["Supervisee", "Ava Villareal · NC LCMHCA"],
                ["Rule", "21 NCAC 53 .0301 · v2024.03"],
                ["Signatures", "2 of 2 · both parties"],
              ].map(([k, v]) => (
                <li key={k} className="grid grid-cols-[110px_1fr] items-baseline gap-3 text-sm">
                  <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-[color:var(--ink-500)]">
                    {k}
                  </span>
                  <strong className="font-medium text-[color:var(--ink-800)]">{v}</strong>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 border-t border-[color:var(--ink-100)] pt-3 font-mono text-xs text-[color:var(--seal-gold)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sealed &amp; verified · hash matches
            </div>
          </div>
        </div>
      </section>

      {/* Anatomy */}
      <section className="border-t border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            What&apos;s inside the package
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground max-w-3xl">
            One PDF. Every fact the board cares about. Nothing the board
            doesn&apos;t.
          </h2>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="rounded-[14px] border-[color:var(--ink-200)] border-t-2 border-t-[color:var(--seal-gold)] bg-[color:var(--paper-white)]">
              <CardContent className="p-8">
                <FileSignature
                  className="h-6 w-6 text-[color:var(--ink-900)]"
                  strokeWidth={2}
                />
                <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                  Every signed session
                </h3>
                <p className="mt-2 text-[color:var(--ink-600)] leading-relaxed">
                  Date, type, duration, supervisor credential snapshot,
                  supervisee signature with intent confirmation. Citation-linked
                  to the state rule that was current the day each session was
                  signed.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[14px] border-[color:var(--ink-200)] border-t-2 border-t-[color:var(--seal-gold)] bg-[color:var(--paper-white)]">
              <CardContent className="p-8">
                <Hash
                  className="h-6 w-6 text-[color:var(--seal-gold)]"
                  strokeWidth={2}
                />
                <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                  Tamper-evident hash
                </h3>
                <p className="mt-2 text-[color:var(--ink-600)] leading-relaxed">
                  Every page is SHA-256 hashed, and the package as a whole is
                  hashed and embedded. Modify a single comma and the board can
                  prove it. Boards trust the proof — not the paperwork.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[14px] border-[color:var(--ink-200)] border-t-2 border-t-[color:var(--seal-gold)] bg-[color:var(--paper-white)]">
              <CardContent className="p-8">
                <ShieldCheck
                  className="h-6 w-6 text-[color:var(--seal-gold)]"
                  strokeWidth={2}
                />
                <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                  Independently verifiable
                </h3>
                <p className="mt-2 text-[color:var(--ink-600)] leading-relaxed">
                  Each package includes a verify-URL that anyone — auditor,
                  board, employer — can paste into a browser. The page returns
                  whether the document content matches its sealed hash. No
                  account required.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* When it's sealed */}
      <section className="border-t border-[color:var(--ink-200)]">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
            <div className="lg:col-span-1">
              <Badge variant="outline" className="mb-4">
                Lifecycle
              </Badge>
              <h2 className="font-display text-3xl font-semibold text-foreground">
                Sealed at the moment of signing.
              </h2>
              <p className="mt-4 text-[color:var(--ink-600)] leading-relaxed">
                Evidence packages aren&apos;t something you generate later.
                Every supervision session creates one the moment supervisor and
                supervisee both sign with intent — automatically, atomically,
                immutably.
              </p>
            </div>
            <Card className="lg:col-span-2 rounded-[14px] border-[color:var(--ink-200)] bg-[color:var(--paper-white)]">
              <CardContent className="p-8 space-y-6">
                <Step
                  Icon={FileSignature}
                  step="01"
                  title="Session signed"
                  body="Supervisor and supervisee both confirm intent. Each signature is timestamped, attributed, and immutable."
                />
                <Step
                  Icon={Hash}
                  step="02"
                  title="Package sealed"
                  body="The session record, the rule citation, the credential snapshot, and both signatures are bundled and SHA-256 hashed."
                />
                <Step
                  Icon={Clock}
                  step="03"
                  title="Stored forever"
                  body="The supervisee carries the package. So do you. Either of you can hand it to the board years later — the hash still verifies."
                />
                <Step
                  Icon={ExternalLink}
                  step="04"
                  title="Verified on demand"
                  body="Boards and employers paste the verify-URL into a browser; AuditHalo returns the integrity check, signed and timestamped."
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[color:var(--ink-200)]">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
            Stop reconstructing supervision records before audits.
          </h2>
          <p className="mt-4 text-lg text-[color:var(--ink-600)] max-w-2xl mx-auto">
            Every session your supervisee logs becomes part of an audit-ready
            evidence package the moment it&apos;s signed. Start a 14-day trial —
            no credit card.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="https://app.audithalo.com/register">
                Start your supervisor account <ArrowRight />
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

function Step({
  Icon,
  step,
  title,
  body,
}: {
  Icon: React.ElementType;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-12 h-12 rounded-sm border border-[color:var(--ink-200)] bg-[color:var(--paper-100)] flex items-center justify-center">
        <Icon
          className="h-5 w-5 text-[color:var(--seal-gold)]"
          strokeWidth={1.75}
        />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-xs text-[color:var(--ink-500)]">{step}</p>
        <h3 className="mt-1 font-display text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-[color:var(--ink-600)] leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
