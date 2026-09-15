import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAllDocs } from "@/lib/docs";
import { DOC_CATEGORIES, buildDocsNav } from "@/lib/docs-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const URL = "https://audithalo.com/docs";

export const metadata = {
  title: "Help center | AuditHalo docs",
  description:
    "Guides for supervisors, supervisees, HR admins, and executives: logging and signing sessions, state rules, evidence packages, billing, and account security.",
  alternates: { canonical: URL },
};

export default function DocsIndexPage() {
  const nav = buildDocsNav(getAllDocs());
  const gettingStarted = nav.find((c) => c.slug === "getting-started");

  // Article counts per category, for the topic grid. The grid renders the full
  // taxonomy (all categories) so the structure is visible before every section
  // is written; empty categories link to a "coming soon" category page.
  const countBySlug = new Map(nav.map((c) => [c.slug, c.articles.length]));
  const rest = DOC_CATEGORIES.filter((c) => c.slug !== "getting-started");

  return (
    <section>
      <Badge variant="outline" className="mb-6">
        Help center
      </Badge>
      <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground leading-[1.1]">
        Documentation.
      </h1>
      <p className="mt-6 text-lg text-[color:var(--ink-600)] leading-relaxed max-w-2xl">
        Everything you need to run audit-ready supervision, organized by task.
        New here? Start with the guide for your role.
      </p>

      {gettingStarted && gettingStarted.articles.length > 0 && (
        <div className="mt-12">
          <p className="label-overline mb-4">Start here</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gettingStarted.articles.map((a) => (
              <Link key={a.path} href={`/docs/${a.path}`} className="block group">
                <Card className="h-full transition-colors group-hover:border-[color:var(--ink-400)]">
                  <CardContent className="p-5 flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground group-hover:text-[color:var(--ink-700)]">
                      {a.title}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[color:var(--ink-900)] shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-14">
        <p className="label-overline mb-4">Browse by topic</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rest.map((cat) => (
            <Link
              key={cat.slug}
              href={`/docs/${cat.slug}`}
              className="block group h-full"
            >
              <Card className="h-full transition-colors group-hover:border-[color:var(--ink-400)]">
                <CardContent className="p-6">
                  <h2 className="font-display text-lg font-semibold text-foreground group-hover:text-[color:var(--ink-700)]">
                    {cat.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-[color:var(--ink-600)] leading-relaxed">
                    {cat.description}
                  </p>
                  <p className="mt-3 text-xs text-[color:var(--ink-500)]">
                    {(() => {
                      const n = countBySlug.get(cat.slug) ?? 0;
                      return n === 0
                        ? "Coming soon"
                        : `${n} article${n === 1 ? "" : "s"}`;
                    })()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
