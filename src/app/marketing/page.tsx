import Link from "next/link";
import {
  ShieldCheck,
  MapPin,
  AlertTriangle,
  Check,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SealMedallion } from "@/components/marketing/seal-medallion";
import { StateMarquee } from "@/components/marketing/state-marquee";
import { jsonLdScript, softwareApplicationJsonLd } from "@/lib/seo";

export const metadata = {
  title: "AuditHalo — State-board compliance software for mental health supervisors",
  description:
    "Track pre-licensed mental health counselor hours, signatures, and state-board requirements — then generate audit-ready evidence packages when your board asks. Built for LCMHCA, APCC, LPC-A, RMHCI, LP-MHC, LAC, LACMH, LPC, PLPC, and LMHCA supervisors — your board, versioned.",
};

// The three locked value pillars (design-system-v2.md §15.2). Titles are locked
// copy — do not reword. Same three appear on /features and /for-supervisors.
const valuePillars = [
  {
    icon: ShieldCheck,
    title: "Hours you can prove",
    body: "Every signed session seals into a tamper-evident, SHA-256-hashed evidence package — contemporaneous, citation-linked, and independently verifiable by a state board without leaving AuditHalo.",
    href: "/evidence-packages",
    link: "See the evidence format",
  },
  {
    icon: MapPin,
    title: "Your board, versioned",
    body: "Every rule is pinned to a version and a verified-on date. When your board publishes a change, we roll a new version, notify every supervisor it affects, and never quietly rewrite a rule under an already-sealed package.",
    href: "/states",
    link: "See how rules are versioned",
  },
  {
    icon: AlertTriangle,
    title: "No gaps. No surprises.",
    body: "Live tracking of direct, individual, group, and coursework hours against the exact rule that governs each supervisee. At-risk flags 60 days before a deadline, not two weeks after.",
    href: "/features",
    link: "See the compliance view",
  },
];

const states = [
  { code: "NC", license: "LCMHCA", href: "/states/nc-lcmhca" },
  { code: "CA", license: "APCC", href: "/states/ca-apcc" },
  { code: "TX", license: "LPC-A", href: "/states/tx-lpc-associate" },
  { code: "FL", license: "RMHCI", href: "/states/fl-rmhci" },
  { code: "NY", license: "LP-MHC", href: "/states/ny-lmhc-lp" },
  { code: "AZ", license: "LAC", href: "/states/az-lac" },
  { code: "DE", license: "LACMH", href: "/states/de-lacmh" },
  { code: "OH", license: "LPC", href: "/states/oh-lpc" },
  { code: "LA", license: "PLPC", href: "/states/la-plpc" },
  { code: "WA", license: "LMHCA", href: "/states/wa-lmhca" },
];

const steps = [
  {
    num: "01",
    title: "Meet, and log",
    body: "A supervision session in person, on Teams, or on Google Meet. AuditHalo captures the time, modality, and — with consent — a transcript to draft the note from.",
    chips: (
      <>
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] px-2.5 py-1 font-mono text-xs text-[color:var(--ink-700)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ok-700)]" /> Live · 42:18
        </span>
        <span className="rounded-sm border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] px-2.5 py-1 font-mono text-xs text-[color:var(--ink-700)]">
          Google Meet
        </span>
        <span className="rounded-sm border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] px-2.5 py-1 font-mono text-xs text-[color:var(--ink-700)]">
          21 NCAC 53
        </span>
      </>
    ),
  },
  {
    num: "02",
    title: "Draft, review, sign",
    body: "AI drafts a structured note — topics, competencies, feedback, next steps — from the transcript. The supervisor edits inline and signs; the supervisee counter-signs from their phone.",
    chips: (
      <>
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--seal-gold)] bg-[color:var(--halo-yellow)] px-2.5 py-1 font-mono text-xs text-[color:var(--ink-900)]">
          <Sparkles className="h-3 w-3" /> AI-drafted from transcript
        </span>
        <span className="rounded-sm border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] px-2.5 py-1 font-mono text-xs text-[color:var(--ink-700)]">
          2 signers
        </span>
      </>
    ),
  },
  {
    num: "03",
    title: "Seal, and file",
    body: "The note becomes an evidence package with a SHA-256 hash, a governing-rule citation, and a public verification URL your state board can open without an account.",
    chips: (
      <>
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] px-2.5 py-1 font-mono text-xs text-[color:var(--ink-700)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--seal-gold)]" /> Sealed · verifiable
        </span>
        <span className="rounded-sm bg-[color:var(--paper-100)] px-2.5 py-1 font-mono text-xs text-[color:var(--ink-500)]">
          sha256:9f2c…a47e
        </span>
      </>
    ),
  },
];

export default function MarketingHome() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(softwareApplicationJsonLd())}
      />

      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-6xl px-6 py-14 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-8 items-center">
          {/* Left */}
          <div className="max-w-xl">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-[color:var(--ink-600)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--halo-yellow)] shadow-[0_0_0_3px_rgba(255,214,10,0.22)]" />
              For pre-licensed counselors and their supervisors
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-[color:var(--ink-900)] leading-[1.05] tracking-tight">
              Supervision compliance software for mental health supervisors.
            </h1>
            <p className="mt-6 text-lg text-[color:var(--ink-600)] leading-relaxed">
              Track pre-licensed counselor hours, signatures, and state-board
              requirements — then generate audit-ready evidence packages when your
              board asks.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <a href="https://app.audithalo.com/register">
                  Start your supervisor account <ArrowRight />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/for-supervisors">See how it works</Link>
              </Button>
            </div>
            {/* Trust marquee */}
            <div className="mt-10 border-t border-[color:var(--ink-200)] pt-5">
              <span className="mb-3 block font-mono text-[0.6875rem] uppercase tracking-wider text-[color:var(--ink-500)]">
                Currently tracking hours for supervisees credentialed in
              </span>
              <StateMarquee items={states} />
            </div>
          </div>

          {/* Right — evidence-package proof card (illustrative sample) */}
          <div className="relative">
            <div className="relative rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-5 shadow-[0_24px_60px_-30px_rgba(14,14,12,0.25)]">
              <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[14px] bg-[color:var(--seal-gold)]" />
              <div className="mb-4 flex items-start gap-4">
                <SealMedallion />
                <div>
                  <div className="label-overline">Evidence Package · Sealed</div>
                  <h2 className="mt-1 font-display text-xl font-bold leading-tight text-[color:var(--ink-900)]">
                    Individual Supervision · Ava Villareal
                  </h2>
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
                  ["Modality", "Individual · Google Meet"],
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
                <Check className="h-3.5 w-3.5" />
                Verify at audithalo.com/verify
              </div>
            </div>
          </div>
        </div>

        {/* Hero trust chips (real, non-numeric) */}
        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[color:var(--ink-500)]">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--ok-700)]" />
            14-day free trial
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--ok-700)]" />
            No credit card required
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--ok-700)]" />
            Supervisee accounts always free
          </span>
        </div>
      </section>

      {/* ======================= VALUE PILLARS ======================= */}
      <section id="features" className="border-t border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">What you get</Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[color:var(--ink-900)] max-w-2xl">
            Everything a state board audit requires. Nothing it doesn&apos;t.
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
            {valuePillars.map((p) => (
              <article
                key={p.title}
                className="flex flex-col gap-3 rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-5 transition-colors hover:border-[color:var(--ink-400)]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-[color:var(--paper-100)] text-[color:var(--ink-900)]">
                  <p.icon className="h-7 w-7" strokeWidth={2} />
                </div>
                <h3 className="font-display text-xl font-semibold text-[color:var(--ink-900)]">
                  {p.title}
                </h3>
                <p className="flex-grow text-[color:var(--ink-600)] leading-relaxed">{p.body}</p>
                <Link
                  href={p.href}
                  className="self-start border-b-[1.5px] border-[color:var(--halo-yellow)] pb-0.5 font-mono text-sm text-[color:var(--ink-900)] transition-colors hover:border-[color:var(--ink-900)]"
                >
                  {p.link} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= HOW IT WORKS ======================= */}
      <section className="border-t border-[color:var(--ink-200)]">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">How it works</Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[color:var(--ink-900)] max-w-2xl">
            Three steps. One sealed record.
          </h2>
          <ol className="mt-10 grid gap-4">
            {steps.map((s) => (
              <li
                key={s.num}
                className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-5 rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6"
              >
                <div className="mkt-num-emboss font-display text-5xl font-black leading-none tracking-tight">
                  {s.num}
                </div>
                <div>
                  <h3 className="font-display text-2xl font-semibold text-[color:var(--ink-900)]">
                    {s.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-[color:var(--ink-600)] leading-relaxed">{s.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">{s.chips}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ==================== FEATURE DEEP-DIVES ==================== */}
      <section className="border-t border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">The features behind the promise</Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[color:var(--ink-900)] max-w-2xl">
            Real components, not stock screenshots.
          </h2>

          {/* Row 1 — hour progress ring */}
          <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="flex justify-center">
              <div className="w-full max-w-[440px] rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6">
                <div className="label-overline mb-3">Hour progress · Ava Villareal · 21 NCAC 53</div>
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] items-center gap-5 justify-items-center">
                  <svg viewBox="0 0 220 220" width="180" height="180" aria-hidden="true">
                    <circle cx="110" cy="110" r="96" fill="none" stroke="var(--paper-100)" strokeWidth="12" />
                    <circle cx="110" cy="110" r="96" fill="none" stroke="var(--ink-900)" strokeWidth="12" strokeLinecap="round" strokeDasharray="603" strokeDashoffset="163" transform="rotate(-90 110 110)" />
                    <circle cx="110" cy="110" r="76" fill="none" stroke="var(--paper-100)" strokeWidth="10" />
                    <circle cx="110" cy="110" r="76" fill="none" stroke="var(--halo-yellow)" strokeWidth="10" strokeLinecap="round" strokeDasharray="477" strokeDashoffset="57" transform="rotate(-90 110 110)" />
                    <circle cx="110" cy="110" r="58" fill="none" stroke="var(--paper-100)" strokeWidth="8" />
                    <circle cx="110" cy="110" r="58" fill="none" stroke="var(--sage-500)" strokeWidth="8" strokeLinecap="round" strokeDasharray="364" strokeDashoffset="0" transform="rotate(-90 110 110)" />
                    <text x="110" y="106" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="32" fill="var(--ink-900)">73%</text>
                    <text x="110" y="126" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-500)" letterSpacing="1.2">ON TRACK</text>
                  </svg>
                  <div className="flex flex-col gap-3">
                    {[
                      ["var(--ink-900)", "Total supervised", "1,314 / 1,800"],
                      ["var(--halo-yellow)", "Individual", "88 / 100"],
                      ["var(--sage-500)", "Group", "50 / 50 · Met"],
                    ].map(([dot, label, val]) => (
                      <div key={label} className="flex items-start gap-2">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} />
                        <div>
                          <div className="text-xs uppercase tracking-wider text-[color:var(--ink-500)]">{label}</div>
                          <div className="font-mono text-sm text-[color:var(--ink-900)]">{val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="max-w-lg">
              <span className="mb-3 inline-block rounded-sm bg-[color:var(--halo-yellow)] px-2.5 py-1 label-overline text-[color:var(--ink-900)]">
                Hour tracking
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[color:var(--ink-900)]">
                Every hour, categorized correctly.
              </h3>
              <p className="mt-3 text-[color:var(--ink-600)] leading-relaxed">
                Direct client hours, individual supervision, group supervision, and
                coursework — tracked separately, against the exact minimums for each
                supervisee&apos;s credential. No mental math when the board audits.
              </p>
              <ul className="mt-4 grid gap-3">
                {[
                  "Real-time cycle-progress ring",
                  "Category-level minimums for each state",
                  "At-risk flags before the cycle ends",
                ].map((li) => (
                  <li key={li} className="flex items-center gap-2.5 text-[color:var(--ink-800)]">
                    <Check className="h-4 w-4 shrink-0 text-[color:var(--sage-500)]" strokeWidth={2.5} />
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Row 2 — sealed evidence card (reversed) */}
          <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative w-full max-w-[380px] rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-5">
                <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[14px] bg-[color:var(--seal-gold)]" />
                <div className="label-overline">Evidence Package · Sealed</div>
                <h4 className="mt-1 mb-3 font-display text-xl font-bold text-[color:var(--ink-900)]">
                  Individual Supervision
                </h4>
                <div className="mb-3 rounded bg-[color:var(--paper-100)] p-2.5">
                  <code className="break-all font-mono text-xs text-[color:var(--ink-800)]">sha256:9f2c1a…a47e</code>
                </div>
                <div className="mb-3 grid gap-2">
                  {[
                    ["Signed", "2 signers"],
                    ["Rule", "21 NCAC 53"],
                    ["Verified", "Aug 1, 2026"],
                  ].map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[80px_1fr] gap-2 text-[0.8125rem]">
                      <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-[color:var(--ink-500)]">{k}</span>
                      <strong className="font-medium text-[color:var(--ink-800)]">{v}</strong>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 border-t border-[color:var(--ink-100)] pt-3 font-mono text-xs text-[color:var(--seal-gold)]">
                  <ShieldCheck className="h-3.5 w-3.5" /> Sealed &amp; verified
                </div>
              </div>
            </div>
            <div className="order-2 lg:order-1 max-w-lg">
              <span className="mb-3 inline-block rounded-sm bg-[color:var(--halo-yellow)] px-2.5 py-1 label-overline text-[color:var(--ink-900)]">
                Evidence packages
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[color:var(--ink-900)]">
                Every session, sealed like a filing.
              </h3>
              <p className="mt-3 text-[color:var(--ink-600)] leading-relaxed">
                When both parties sign, the note becomes an evidence package with a
                SHA-256 hash, a governing-rule citation, and a public verification URL.
                Change one character of the note and the hash changes; if the hash
                changes, the seal breaks.
              </p>
              <ul className="mt-4 grid gap-3">
                {[
                  "SHA-256 content hash on every seal",
                  "Signer name, credential, IP, and intent captured",
                  "Public verify URL for state-board reviewers",
                ].map((li) => (
                  <li key={li} className="flex items-center gap-2.5 text-[color:var(--ink-800)]">
                    <Check className="h-4 w-4 shrink-0 text-[color:var(--sage-500)]" strokeWidth={2.5} />
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Row 3 — rule engine */}
          <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="flex justify-center">
              <div className="w-full max-w-[420px] rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-5">
                <div className="mb-4 flex items-center justify-between border-b border-[color:var(--ink-100)] pb-3">
                  <h4 className="font-display text-lg font-bold text-[color:var(--ink-900)]">Rule engine · v2024.03</h4>
                  <Badge variant="ok"><Check className="h-3 w-3" /> Verified quarterly</Badge>
                </div>
                <ul className="grid gap-3">
                  {[
                    ["21 NCAC 53", "North Carolina LCMHCA", "ok", "Verified Aug 1"],
                    ["16 CCR 1820", "California APCC", "ok", "Verified Aug 1"],
                    ["22 TAC 681", "Texas LPC-A", "ok", "Verified Aug 1"],
                    ["64B4-31", "Florida RMHCI", "warn", "Change pending"],
                  ].map(([code, title, tone, label]) => (
                    <li key={code as string} className="grid grid-cols-[100px_1fr_auto] items-center gap-3 rounded-md bg-[color:var(--paper-100)] px-3 py-2.5">
                      <span className="font-mono text-[0.8125rem] font-semibold text-[color:var(--ink-900)]">{code}</span>
                      <span className="text-sm text-[color:var(--ink-800)]">{title}</span>
                      {tone === "warn" ? (
                        <Badge variant="outline-warn"><AlertTriangle className="h-3 w-3" />{label}</Badge>
                      ) : (
                        <Badge variant="ok"><Check className="h-3 w-3" />{label}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="max-w-lg">
              <span className="mb-3 inline-block rounded-sm bg-[color:var(--halo-yellow)] px-2.5 py-1 label-overline text-[color:var(--ink-900)]">
                Rule engine
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[color:var(--ink-900)]">
                Live rule engine. Versioned per board.
              </h3>
              <p className="mt-3 text-[color:var(--ink-600)] leading-relaxed">
                Every rule is pinned to a version and a verification date. When your
                board publishes a change, we roll a new version, notify every
                supervisor it affects, and never quietly rewrite a rule under a sealed
                evidence package.
              </p>
              <ul className="mt-4 grid gap-3">
                {[
                  "Version-pinned rule set (v2024.03)",
                  "Last-verified date on every rule card",
                  "Sealed packages keep the rule version that governed them",
                ].map((li) => (
                  <li key={li} className="flex items-center gap-2.5 text-[color:var(--ink-800)]">
                    <Check className="h-4 w-4 shrink-0 text-[color:var(--sage-500)]" strokeWidth={2.5} />
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ========================= STATES ========================= */}
      <section className="border-t border-[color:var(--ink-200)]">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">Supported states</Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[color:var(--ink-900)] max-w-2xl">
            More boards, on request.
          </h2>
          <p className="mt-3 text-[color:var(--ink-600)] max-w-2xl">
            Your board, versioned — every rule citation-linked to the state
            administrative code and re-verified quarterly. Don&apos;t see your board?
            Tell us and we&apos;ll add it.
          </p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link href="/contact">Request a new state</Link>
            </Button>
          </div>
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {states.map((s) => (
              <Link
                key={s.code}
                href={s.href}
                className="group flex flex-col gap-1 rounded-[10px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-4 transition-all hover:-translate-y-0.5 hover:border-[color:var(--ink-900)]"
              >
                <span className="font-display text-4xl font-bold leading-none tracking-tight text-[color:var(--ink-900)]">
                  {s.code}
                </span>
                <span className="mt-2 border-t border-[color:var(--ink-100)] pt-2 font-mono text-xs font-semibold text-[color:var(--ink-800)]">
                  {s.license}
                </span>
                <span className="font-mono text-[0.6875rem] text-[color:var(--ink-500)] group-hover:text-[color:var(--ink-700)]">
                  View requirements →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= TESTIMONIAL =======================
          PLACEHOLDER social proof — the quote, attribution, and practice
          names below are illustrative and MUST be replaced with a real,
          consented customer quote + real logos before this goes to
          production (content-fact-integrity). Design shown for review. */}
      <section className="border-t border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <div className="relative mx-auto max-w-3xl rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-8 sm:p-10">
            <div className="mkt-quote-mark pointer-events-none absolute -top-8 left-8 select-none font-serif text-8xl font-black leading-none">
              &ldquo;
            </div>
            <blockquote className="font-display text-2xl sm:text-3xl font-semibold leading-tight tracking-tight text-[color:var(--ink-900)]">
              My board audit used to be a three-week scramble through Google Docs and
              calendar screenshots. Last cycle I handed the reviewer{" "}
              <em className="mkt-hl not-italic">one URL</em> per supervisee, and she
              was done in an afternoon.
            </blockquote>
            <div className="mt-6 flex items-center gap-3 border-t border-[color:var(--ink-100)] pt-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--sage-500)] font-mono text-sm font-semibold text-[color:var(--paper-50)]">
                JS
              </div>
              <div>
                <div className="font-display font-semibold text-[color:var(--ink-900)]">
                  Placeholder — pending a real customer quote
                </div>
                <div className="mt-0.5 font-mono text-xs text-[color:var(--ink-500)]">
                  Clinical Supervisor · replace before launch
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================== FOOTER CTA BAND ====================== */}
      <section className="border-t border-[color:var(--ink-200)] bg-[color:var(--halo-yellow)]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-bold leading-tight tracking-tight text-[color:var(--ink-900)]">
            Ready to make your next audit boring?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[color:rgba(14,14,12,0.75)]">
            Start a 14-day free trial. No credit card. Every session you log is a real,
            sealable evidence package — yours to keep.
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
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
