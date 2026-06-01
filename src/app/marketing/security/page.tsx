import Link from "next/link";
import { Shield, Lock, Database, FileCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Security & Compliance — AuditHalo",
  description:
    "Our current security posture, our path to HIPAA + SOC 2, and how we handle PHI in clinical supervision data.",
};

const today = [
  {
    icon: Lock,
    title: "Authentication",
    body: "Passwords are bcrypt-hashed (cost factor 12). Sessions are stored in HttpOnly cookies scoped host-only to app.audithalo.com so they can never leak to the marketing site or any other origin. Auth.js v5 powers session management.",
  },
  {
    icon: Database,
    title: "Data hosting",
    body: "Application runs on Vercel (US-East). Database is Neon Postgres (US-East-1). All traffic is TLS 1.3 in transit. Data at rest is encrypted by the underlying cloud providers.",
  },
  {
    icon: Shield,
    title: "PHI posture (current)",
    body: "We do not accept Protected Health Information on the platform. Every transcript submitted passes a pre-scan that flags obvious identifiers (names, phone numbers, addresses, dates) before submission. Users warrant on submit that no PHI is contained. Our AI provider does not retain submitted content.",
  },
  {
    icon: FileCheck,
    title: "Audit trail",
    body: "Every signature, rule-version change, evidence-package creation is logged immutably per organization with 7-year retention. Evidence packages are SHA-256 hashed at creation — auditors can verify independently.",
  },
];

const roadmap = [
  {
    when: "v1 (today)",
    items: [
      "Bcrypt password hashing, HttpOnly host-only session cookies",
      "TLS 1.3 in transit, encryption at rest",
      "PHI pre-scan + user-warrant model — no PHI on the platform",
      "Immutable per-org audit log, SHA-256 evidence packages",
    ],
  },
  {
    when: "v1.1 — first practice customer",
    items: [
      "SOC 2 controls in place: MFA on admin accounts, dependency scanning, secrets management, employee laptop policy",
      "Resend / Postmark with BAA available for transactional email",
      "Sentry error monitoring with PHI scrubbing",
    ],
  },
  {
    when: "v2 — Enterprise / HIPAA",
    items: [
      "BAA-eligible infrastructure: AWS (S3 + RDS Postgres + ECS) and Azure OpenAI",
      "Encrypted-at-rest fields for any transcript content stored at customer request",
      "SSO via SAML / OIDC",
      "SOC 2 Type 1 audit, with Type 2 six months later",
      "Customer-signed BAA, custom DPA, breach notification process",
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <Badge variant="outline" className="mb-4">
          Security &amp; Compliance
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground max-w-3xl">
          Honest about where we are. Building toward where serious customers
          need us to be.
        </h1>
        <p className="mt-6 text-lg text-foreground/70 max-w-2xl">
          AuditHalo handles compliance evidence. The bar for our own security
          and compliance posture is high — and we'll tell you exactly where we
          are today, not market-speak.
        </p>
      </section>

      {/* Today */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Today
          </Badge>
          <h2 className="font-display text-3xl font-semibold text-foreground max-w-2xl">
            What's in place right now.
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {today.map((item) => (
              <Card key={item.title}>
                <CardContent className="p-8">
                  <item.icon
                    className="h-6 w-6 text-secondary"
                    strokeWidth={1.75}
                  />
                  <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-foreground/70 leading-relaxed">
                    {item.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* HIPAA explanation */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            On HIPAA &amp; PHI
          </Badge>
          <h2 className="font-display text-3xl font-semibold text-foreground">
            The straight story.
          </h2>
          <div className="mt-8 space-y-6 text-foreground/80 leading-relaxed">
            <p>
              <strong className="text-foreground">
                A clinical supervision conversation can contain PHI.
              </strong>{" "}
              When a supervisee discusses a case, the transcript can include
              client names, dates, identifying details, or specific clinical
              facts — any of which qualify as Protected Health Information under
              HIPAA's 18 safe-harbor identifiers.
            </p>
            <p>
              <strong className="text-foreground">
                Today, AuditHalo handles this by not accepting PHI.
              </strong>{" "}
              Before any transcript is submitted, our pre-scan flags obvious
              identifiers and shows you what we found. You confirm the
              transcript contains no PHI. Our AI provider's standard terms
              include no data retention. This is a defensible posture for solo
              supervisors and small practices, and it's the right tradeoff for
              shipping a real product on day one.
            </p>
            <p>
              <strong className="text-foreground">
                For practices and agencies that need a signed BAA,
              </strong>{" "}
              we operate the Enterprise tier on BAA-eligible infrastructure —
              AWS Postgres + Azure OpenAI + Postmark, all with signed BAAs.
              Talk to us if your compliance officer needs to review.
            </p>
            <Button asChild variant="outline">
              <Link href="/contact?topic=baa">
                Request a BAA conversation <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 py-20 lg:py-24">
          <Badge variant="outline" className="mb-4">
            Roadmap
          </Badge>
          <h2 className="font-display text-3xl font-semibold text-foreground">
            What's coming, in order.
          </h2>
          <div className="mt-10 space-y-10">
            {roadmap.map((phase) => (
              <div
                key={phase.when}
                className="grid grid-cols-1 md:grid-cols-4 gap-6 border-l-2 border-secondary pl-6"
              >
                <p className="label-overline">{phase.when}</p>
                <ul className="md:col-span-3 space-y-2 text-foreground/80">
                  {phase.items.map((i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-secondary mt-1.5">▸</span>
                      <span className="leading-relaxed">{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Questions?
          </h2>
          <p className="mt-4 text-foreground/70">
            We'll answer anything — current posture, roadmap, BAA, DPA. No
            sales pitch.
          </p>
          <Button asChild size="lg" className="mt-8" variant="outline">
            <Link href="/contact?topic=security">
              Talk to us <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
