import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  FileSignature,
  CalendarClock,
  AlertTriangle,
  TriangleAlert,
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
  const pc = rule.page_content;
  const description = pc?.intro
    ? pc.intro.replace(/\s+/g, " ").trim().slice(0, 160)
    : rule.summary.replace(/\s+/g, " ").trim().slice(0, 160);
  const title = `${rule.jurisdiction} ${rule.license_code} Supervision Hours & Requirements — AuditHalo`;
  const url = `https://audithalo.com/states/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "AuditHalo",
      type: "article",
      // og:image intentionally omitted — no asset exists yet; add when one is designed
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
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
  const pc = rule.page_content;

  // Build structured data for SEO rich snippets
  const jsonLd: object[] = [];

  // BreadcrumbList — always
  jsonLd.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://audithalo.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "States",
        item: "https://audithalo.com/states",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${rule.jurisdiction} ${rule.license_code}`,
        item: `https://audithalo.com/states/${slug}`,
      },
    ],
  });

  // FAQPage — only if page_content has faq entries
  if (pc?.faq && pc.faq.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: pc.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    });
  }

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
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

      {/* Intro + technical requirements */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Intro paragraphs */}
              {pc?.intro && (
                <Card>
                  <CardContent className="p-8">
                    <p className="label-overline mb-3">Overview</p>
                    <div className="space-y-4 text-foreground/80 leading-relaxed">
                      {pc.intro.trim().split(/\n\s*\n/).map((para, i) => (
                        <p key={i}>{para.trim()}</p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Hour requirements */}
              <Card>
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
                          <dt className="text-foreground/60">Min. individual share</dt>
                          <dd className="mt-1 font-display text-2xl font-semibold text-foreground">
                            {(rule.structured.min_individual_supervision_fraction * 100).toFixed(0)}%
                          </dd>
                        </div>
                      )}
                      {rule.structured.group_max_attendees != null && (
                        <div>
                          <dt className="text-foreground/60">Group session max</dt>
                          <dd className="mt-1 font-display text-2xl font-semibold text-foreground">
                            {rule.structured.group_max_attendees}{" "}
                            <span className="text-base text-foreground/60">attendees</span>
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
                            <p className="font-medium text-foreground">{c.description}</p>
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

              {/* Supervisor qualifications */}
              {pc?.supervisor_qualifications && pc.supervisor_qualifications.length > 0 && (
                <Card>
                  <CardContent className="p-8">
                    <p className="label-overline mb-3">Supervisor qualifications</p>
                    <ul className="space-y-3 text-sm text-foreground/80">
                      {pc.supervisor_qualifications.map((q, i) => (
                        <li key={i} className="flex gap-3">
                          <FileSignature className="h-4 w-4 mt-0.5 shrink-0 text-secondary" strokeWidth={1.75} />
                          <span className="leading-relaxed">{q}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Key warnings */}
              {pc?.key_warnings && pc.key_warnings.length > 0 && (
                <Card className="border-[color:var(--color-warning)]/30">
                  <CardContent className="p-8">
                    <p className="label-overline mb-3 text-[color:var(--color-warning)]">
                      Common mistakes to avoid
                    </p>
                    <ul className="space-y-3 text-sm text-foreground/80">
                      {pc.key_warnings.map((w, i) => (
                        <li key={i} className="flex gap-3">
                          <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-warning)]" strokeWidth={1.75} />
                          <span className="leading-relaxed">{w}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
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
                      <dd className="text-foreground">{rule.verification.last_verified_by}</dd>
                    </div>
                  </dl>
                  {isPreliminary && (
                    <p className="mt-4 text-xs text-foreground/60 leading-relaxed">
                      This encoding is preliminary — drafted from public sources,
                      awaiting QA by a licensed clinical supervisor in this
                      jurisdiction. Use the citation link to verify anything that
                      matters for your specific situation.
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

              <div className="border border-border rounded-sm p-6 bg-card">
                <p className="font-display text-base font-semibold text-foreground mb-2">
                  Track your {rule.jurisdiction} hours
                </p>
                <p className="text-sm text-foreground/70 mb-4">
                  AuditHalo evaluates every hour you log against this rule and
                  flags issues before they become problems.
                </p>
                <Button asChild size="sm" className="w-full">
                  <a href="https://app.audithalo.com/register">
                    Start free <ArrowRight />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      {pc?.faq && pc.faq.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
            <Badge variant="outline" className="mb-4">
              Frequently asked
            </Badge>
            <h2 className="font-display text-3xl font-semibold text-foreground">
              {rule.jurisdiction} {rule.license_code} — common questions.
            </h2>
            <div className="mt-10 space-y-8">
              {pc.faq.map((item, i) => (
                <div key={i}>
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {item.q}
                  </h3>
                  <p className="mt-2 text-foreground/70 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <Badge variant="outline" className="mb-4">
            Start tracking
          </Badge>
          <h2 className="font-display text-3xl font-semibold text-foreground">
            Track your {rule.jurisdiction} {rule.license_code} supervision hours, audit-ready.
          </h2>
          <p className="mt-4 text-foreground/70">
            14-day free trial. No credit card. Supervisee accounts are free — always.
          </p>
          <Button asChild size="lg" className="mt-8">
            <a href={`https://app.audithalo.com/register?state=${rule.jurisdiction.toLowerCase()}`}>
              Start your supervisor account <ArrowRight />
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
