import Image from "next/image";
import {
  ShieldCheck,
  Sparkles,
  FileSignature,
  BarChart3,
  Calendar,
  Users,
  History,
  Lock,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Features — AuditHalo",
  description:
    "Multi-state rules engine, AI session notes, tamper-evident e-signatures, role-based dashboards, audit packages.",
};

const featureSections: Array<{
  icon: React.ElementType;
  title: string;
  intro: string;
  bullets: string[];
  image?: { src: string; alt: string };
}> = [
  {
    icon: ShieldCheck,
    title: "Multi-state rules engine",
    intro:
      "The whole product is built around this. Every supervised hour is evaluated against your state's rule the moment it's logged.",
    bullets: [
      "Supported today: NC LCMHCA, CA APCC, TX LPC-A, FL RMHCI, NY LP-MHC, AZ LAC, DE LACMH, OH LPC, LA PLPC, WA LMHCA — more boards on request",
      "Every rule is citation-linked to the state administrative code",
      "Versioned with effective dates — in-flight obligations grandfather under the rule they started under",
      "Re-verified quarterly by licensed clinical supervisors on contract",
      "Detects edge cases (telehealth carve-outs, supervisor-qualification mismatches, pre-registration gaps) before they cost you hours",
    ],
    image: {
      src: "/images/feature-rules-engine.png",
      alt: "AuditHalo rules engine showing canonical state rules with citation links to AZ, CA, FL, and NC admin codes",
    },
  },
  {
    icon: Sparkles,
    title: "AI-assisted session notes",
    intro:
      "Paste a supervision transcript — or auto-fetch it from Teams or Google Meet. Get a structured session note your supervisor can review and sign in minutes.",
    bullets: [
      "Structured four-field note: topics discussed, competencies demonstrated, supervisor feedback, and next steps",
      "Prompt is versioned alongside the rule version — auditors can see exactly what the AI was instructed to produce",
      "Supervisor reviews and edits the note before signing — the final record is always human-approved",
      "Supervision notes document the supervisory relationship and counselor development, not client details",
    ],
  },
  {
    icon: FileSignature,
    title: "Tamper-evident e-signatures",
    intro:
      "Built to the standard a state board would accept on appeal. Not a checkbox — a real signature with intent.",
    bullets: [
      "Intent confirmation required — no accidental signatures",
      "Captured fields: signer name + credential, role, timestamp, IP address, intent flag",
      "Both supervisor and supervisee sign — the rule decides who's required",
      "Once all required signers sign, the evidence package is sealed",
      "SHA-256 hash + signed JSON content — independently verifiable years later",
    ],
  },
  {
    icon: BarChart3,
    title: "Role-based dashboards",
    intro:
      "Four roles, four views — same underlying data. Everyone sees what they need without seeing what they shouldn't.",
    bullets: [
      "Supervisee — hour progress, pending signatures, upcoming sessions, evidence package list",
      "Supervisor — roster table with progress %, at-risk flags 60 days before deadline, signature queue",
      "HR Admin — compliance heatmap by state and supervisee, exception report, bulk export",
      "Executive — total supervisees, % compliant, high/medium-risk count, trends",
    ],
  },
  {
    icon: Calendar,
    title: "Scheduling + calendar integration",
    intro:
      "Schedule supervision sessions with Google Meet or Microsoft Teams. Calendar events, reminders, and meeting links are handled automatically.",
    bullets: [
      "Individual or group supervision",
      "Virtual (Teams or Meet) or in-person",
      "Linked to the supervisee's obligation — hours roll up automatically on session completion",
      "Google Calendar + Google Meet and Microsoft Outlook + Teams — connect either or both",
      "Recurring sessions (weekly, biweekly, monthly) with persistent meeting links",
      "Auto-fetch meeting transcript from Teams or Meet for one-click AI note generation",
    ],
  },
  {
    icon: Users,
    title: "Roster + invites",
    intro:
      "Supervisor creates an org. Invites supervisees by email. Supervisees join free and stay free.",
    bullets: [
      "Email invitations with one-click acceptance",
      "Supervisee can be linked to multiple supervisors if needed (group practice scenario)",
      "HR Admin role can manage rosters across multiple supervisors in a practice",
      "Remove or transfer a supervisee — their existing evidence packages remain valid",
    ],
  },
  {
    icon: History,
    title: "Audit log + immutable record",
    intro:
      "Every signature, every rule version change, every evidence package — recorded immutably.",
    bullets: [
      "Per-organization audit log with 7-year retention (matches most state board record requirements)",
      "Evidence packages cannot be modified after sealing — only re-issued (with new hash) by mutual consent",
      "Rule version a supervisee was operating under is preserved with each package",
      "Independently verifiable: hand the board the JSON + hash and they can reproduce verification",
    ],
    image: {
      src: "/images/feature-audit-log.png",
      alt: "AuditHalo audit log with 2FA-gated CSV export and immutable event history",
    },
  },
  {
    icon: Lock,
    title: "Data security",
    intro:
      "Supervision records are sensitive. Here's exactly how we protect them.",
    bullets: [
      "Passwords bcrypt-hashed; sessions in HttpOnly cookies host-scoped to app.audithalo.com",
      "All traffic TLS 1.3 in transit; data at rest encrypted by Neon Postgres and Vercel",
      "Evidence packages SHA-256 hashed at sealing — independently verifiable by anyone with the JSON",
      "7-year immutable per-organization audit log — meets most state board record-retention requirements",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      {/* ============================ HERO ============================ */}
      <section className="mx-auto max-w-6xl px-6 py-14 lg:py-20">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-[color:var(--ink-600)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--halo-yellow)] shadow-[0_0_0_3px_rgba(255,214,10,0.22)]" />
          Features
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-[color:var(--ink-900)] max-w-3xl leading-[1.05] tracking-tight">
          Every piece of the supervision audit, in one product.
        </h1>
        <p className="mt-6 text-lg text-[color:var(--ink-600)] max-w-2xl leading-relaxed">
          Built around what state boards actually require — not what an EHR
          happens to also include.
        </p>
      </section>

      {/* ========================= FEATURES ========================= */}
      {featureSections.map((section, i) => (
        <section
          key={section.title}
          className={`border-t border-[color:var(--ink-200)] ${
            i % 2 === 0
              ? "bg-[color:var(--paper-100)]"
              : "bg-[color:var(--paper-50)]"
          }`}
        >
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
            <article className="rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-10">
                {/* Left — icon tile + title */}
                <div className="md:col-span-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-[color:var(--paper-100)] text-[color:var(--ink-900)]">
                    <section.icon className="h-7 w-7" strokeWidth={2} />
                  </div>
                  <h2 className="mt-4 font-display text-2xl sm:text-3xl font-semibold text-[color:var(--ink-900)]">
                    {section.title}
                  </h2>
                </div>

                {/* Right — intro + bullets + image */}
                <div className="md:col-span-8">
                  <p className="text-[color:var(--ink-600)] leading-relaxed">
                    {section.intro}
                  </p>
                  <ul className="mt-5 grid gap-3">
                    {section.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex gap-2.5 text-[color:var(--ink-800)] leading-relaxed"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--sage-500)]"
                          strokeWidth={2.5}
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  {section.image && (
                    <div className="mt-8 overflow-hidden rounded-[14px] border border-[color:var(--ink-200)]">
                      <Image
                        src={section.image.src}
                        alt={section.image.alt}
                        width={1440}
                        height={900}
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                </div>
              </div>
            </article>
          </div>
        </section>
      ))}

      {/* ====================== FOOTER CTA BAND ====================== */}
      <section className="border-t border-[color:var(--ink-200)] bg-[color:var(--halo-yellow)]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-bold leading-tight tracking-tight text-[color:var(--ink-900)]">
            Try it on your real roster.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[color:rgba(14,14,12,0.75)]">
            Full feature set on the 14-day trial. No credit card.
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              asChild
              size="lg"
              className="bg-[color:var(--ink-900)] text-[color:var(--halo-yellow)] hover:bg-[color:var(--ink-800)] hover:text-[color:var(--halo-yellow)]"
            >
              <a href="https://app.audithalo.com/register">
                Start free trial <ArrowRight />
              </a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
