import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  FileSignature,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import {
  getLatestRuleByJurLic,
  listLatestRules,
  parseSlug,
  ruleSlug,
} from "@/lib/rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return listLatestRules().map((r) => ({
    slug: ruleSlug(r.jurisdiction, r.license_code),
  }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) return { title: "Not found — AuditHalo" };
  const rule = getLatestRuleByJurLic(parsed.jurisdiction, parsed.licenseCode);
  if (!rule) return { title: "Not found — AuditHalo" };
  return {
    title: `${rule.jurisdiction} ${rule.license_code} supervision compliance — AuditHalo`,
    description: `Track your ${rule.jurisdiction} ${rule.license_code} supervised practice hours against ${rule.citation.admincode}. ${rule.summary.replace(/\s+/g, " ").trim().slice(0, 140)}`,
  };
}

export default async function StateRulePage({ params }: { params: Params }) {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) notFound();
  const rule = getLatestRuleByJurLic(parsed.jurisdiction, parsed.licenseCode);
  if (!rule) notFound();

  const verifiedAt =
    typeof rule.verification.last_verified_at === "string"
      ? rule.verification.last_verified_at.slice(0, 10)
      : "—";
  const isPreliminary = rule.verification.last_verified_by.includes("preliminary");

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4">
          <Link href="/states">
            <ArrowLeft />
            All states
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Badge variant="outline">{rule.jurisdiction}</Badge>
          <Badge variant="outline">{rule.license_code}</Badge>
          <Badge variant="outline">v{rule.version}</Badge>
          {isPreliminary && (
            <Badge variant="warning">Preliminary — pending licensed review</Badge>
          )}
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground max-w-3xl">
          {rule.license_name}
        </h1>
        <p className="mt-3 text-foreground/70">{rule.issuing_board}</p>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Summary + hour totals */}
            <Card className="lg:col-span-2">
              <CardContent className="p-8 space-y-6">
                <div>
                  <p className="label-overline mb-2">Summary</p>
                  <p className="text-foreground/80 leading-relaxed whitespace-pre-line">
                    {rule.summary}
                  </p>
                </div>

                <div className="border-t border-border pt-6">
                  <p className="label-overline mb-3">Hour requirements</p>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div>
                      <dt className="text-foreground/60">Total practice hours</dt>
                      <dd className="mt-1 font-display text-2xl font-semibold text-foreground">
                        {rule.structured.total_practice_hours_required.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-foreground/60">Total supervision hours</dt>
                      <dd className="mt-1 font-display text-2xl font-semibold text-foreground">
                        {rule.structured.total_supervision_hours_required.toLocaleString()}
                      </dd>
                    </div>
                    {rule.structured.min_individual_supervision_fraction != null && (
                      <div>
                        <dt className="text-foreground/60">
                          Min. individual supervision share
                        </dt>
                        <dd className="mt-1 font-display text-2xl font-semibold text-foreground">
                          {(
                            rule.structured.min_individual_supervision_fraction * 100
                          ).toFixed(0)}
                          %
                        </dd>
                      </div>
                    )}
                    {rule.structured.group_max_attendees != null && (
                      <div>
                        <dt className="text-foreground/60">Group session max</dt>
                        <dd className="mt-1 font-display text-2xl font-semibold text-foreground">
                          {rule.structured.group_max_attendees}{" "}
                          <span className="text-base text-foreground/60">
                            attendees
                          </span>
                        </dd>
                      </div>
                    )}
                    {(rule.structured.min_duration_months != null ||
                      rule.structured.max_duration_months != null) && (
                      <div className="col-span-2">
                        <dt className="text-foreground/60">Duration window</dt>
                        <dd className="mt-1 font-display text-xl font-semibold text-foreground">
                          {rule.structured.min_duration_months ?? "—"} to{" "}
                          {rule.structured.max_duration_months ?? "—"} months
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="border-t border-border pt-6">
                  <p className="label-overline mb-3">Checks AuditHalo runs</p>
                  <ul className="space-y-3 text-sm">
                    {rule.checks.map((c) => (
                      <li key={c.id} className="flex gap-3">
                        {c.severity === "blocker" ? (
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-risk)]" />
                        ) : c.severity === "warning" ? (
                          <CalendarClock className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-warning)]" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" />
                        )}
                        <div>
                          <p className="font-medium text-foreground">
                            {c.description}
                          </p>
                          <p className="text-xs font-mono text-foreground/50 mt-0.5">
                            {c.id} · {c.severity}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Citation + evidence + verification */}
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <p className="label-overline mb-3">Citation</p>
                  <p className="font-mono text-sm text-foreground">
                    {rule.citation.admincode}
                  </p>
                  {rule.citation.statute && (
                    <p className="font-mono text-xs text-foreground/70 mt-1">
                      {rule.citation.statute}
                    </p>
                  )}
                  <a
                    href={rule.citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm text-secondary hover:underline"
                  >
                    View official source ↗
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <p className="label-overline mb-3">Verification</p>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-foreground/60">Last verified</dt>
                      <dd className="font-mono text-foreground">{verifiedAt}</dd>
                    </div>
                    <div>
                      <dt className="text-foreground/60">Verified by</dt>
                      <dd className="text-foreground">
                        {rule.verification.last_verified_by}
                      </dd>
                    </div>
                  </dl>
                  {isPreliminary && (
                    <p className="mt-4 text-xs text-foreground/60 leading-relaxed">
                      This encoding is preliminary — drafted from public sources, awaiting
                      QA by a licensed clinical supervisor in this jurisdiction before
                      we treat it as production-grade. Use the citation link to verify
                      anything that matters.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <p className="label-overline mb-3">Evidence package</p>
                  <p className="text-sm text-foreground/70">
                    Required signers:{" "}
                    <span className="text-foreground font-medium">
                      {rule.evidence_requirements.required_signers.join(", ")}
                    </span>
                  </p>
                  <p className="text-sm text-foreground/70 mt-2">
                    Immutability:{" "}
                    <span className="text-foreground font-mono text-xs">
                      {rule.evidence_requirements.immutability}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <Badge variant="outline" className="mb-4">
            Start tracking
          </Badge>
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Track your {rule.jurisdiction} {rule.license_code} hours, audit-ready.
          </h2>
          <p className="mt-4 text-foreground/70">
            14-day free trial. No credit card. Supervisees stay free forever.
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
