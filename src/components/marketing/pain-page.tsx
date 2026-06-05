import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FaqSection, type FaqItem } from "@/components/marketing/faq-section";
import { articleJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/seo";

export type PainPageProps = {
  url: string;
  badge: string;
  h1: string;
  intro: string;
  bodyParagraphs: string[];
  keyPoints: { title: string; body: string }[];
  faq: FaqItem[];
  ctaHeading: string;
  datePublished?: string;
  metaDescription: string;
};

export function PainPage(props: PainPageProps) {
  const datePublished = props.datePublished ?? "2026-06-04";
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          articleJsonLd({
            headline: props.h1,
            description: props.metaDescription,
            url: props.url,
            datePublished,
          })
        )}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(faqPageJsonLd(props.faq))}
      />

      <section className="mx-auto max-w-4xl px-6 py-20 lg:py-24">
        <Badge variant="outline" className="mb-6">
          {props.badge}
        </Badge>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground leading-[1.1]">
          {props.h1}
        </h1>
        <p className="mt-6 text-lg text-foreground/75 leading-relaxed">
          {props.intro}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild>
            <a href="https://app.audithalo.com/register">
              Start your supervisor account <ArrowRight />
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/for-supervisors">How AuditHalo works</Link>
          </Button>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 py-16 lg:py-20">
          <div className="space-y-5 text-foreground/80 leading-relaxed">
            {props.bodyParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {props.keyPoints.length > 0 && (
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {props.keyPoints.map((point, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <CheckCircle2
                      className="h-5 w-5 text-[color:var(--color-success)]"
                      strokeWidth={1.75}
                    />
                    <h3 className="mt-3 font-display text-lg font-semibold text-foreground">
                      {point.title}
                    </h3>
                    <p className="mt-1 text-foreground/70 leading-relaxed">
                      {point.body}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <FaqSection items={props.faq} />

      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground">
            {props.ctaHeading}
          </h2>
          <p className="mt-4 text-foreground/70">
            14-day free trial. No credit card. Supervisee accounts free.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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
