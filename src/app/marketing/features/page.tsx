import Link from "next/link";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Features — AuditHalo",
  description:
    "Multi-state rules engine, AI session notes, tamper-evident e-signatures, role-based dashboards, audit packages.",
};

const featureSections = [
  {
    icon: ShieldCheck,
    title: "Multi-state rules engine",
    intro:
      "The whole product is built around this. Every supervised hour is evaluated against your state's rule the moment it's logged.",
    bullets: [
      "Five states at launch: NC LCMHCA, CA APCC, TX LPC-A, FL RMHCI, NY limited permit",
      "Every rule is citation-linked to the state administrative code",
      "Versioned with effective dates — in-flight obligations grandfather under the rule they started under",
      "Re-verified quarterly by licensed clinical supervisors on contract",
      "Detects edge cases (telehealth carve-outs, supervisor-qualification mismatches, pre-registration gaps) before they cost you hours",
    ],
  },
  {
    icon: Sparkles,
    title: "AI-assisted session notes",
    intro:
      "Paste a supervision transcript. Get a structured session note your supervisor can review and sign in minutes.",
    bullets: [
      "7-section structured note: overview, topics covered, competencies addressed, goals, supervisor feedback, and next steps",
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
    title: "Session scheduling + Teams integration",
    intro:
      "Schedule supervision sessions and link them to Microsoft Teams meetings. (Calendar sync ships in v1.1.)",
    bullets: [
      "Individual or group supervision",
      "Virtual (Teams) or in-person",
      "Linked to the supervisee's obligation — hours roll up automatically on session completion",
      "Microsoft Calendar sync (with reminders) ships in v1.1",
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
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <Badge variant="outline" className="mb-4">
          Features
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground max-w-3xl">
          Every piece of the supervision audit, in one product.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl">
          Built around what state boards actually require — not what an EHR
          happens to also include.
        </p>
      </section>

      {/* Feature sections */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 py-16 lg:py-20 space-y-16">
          {featureSections.map((section) => (
            <div key={section.title} className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-3">
                <section.icon
                  className="h-8 w-8 text-secondary"
                  strokeWidth={1.5}
                />
                <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">
                  {section.title}
                </h2>
              </div>
              <div className="md:col-span-9">
                <p className="text-foreground/80 leading-relaxed">
                  {section.intro}
                </p>
                <ul className="mt-4 space-y-2 text-foreground/70">
                  {section.bullets.map((b) => (
                    <li key={b} className="flex gap-3">
                      <span className="text-secondary mt-1.5">▸</span>
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Try it on your real roster.
          </h2>
          <p className="mt-4 text-foreground/70">
            Full feature set on the 14-day trial. No credit card.
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
