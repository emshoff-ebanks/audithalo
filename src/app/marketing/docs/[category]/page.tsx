import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getAllDocs } from "@/lib/docs";
import { DOC_CATEGORIES, buildDocsNav } from "@/lib/docs-nav";
import { DocsBreadcrumbs } from "@/components/marketing/docs-breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";

const BASE = "https://audithalo.com";

type Params = Promise<{ category: string }>;

export function generateStaticParams() {
  return DOC_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { category } = await params;
  const cat = DOC_CATEGORIES.find((c) => c.slug === category);
  if (!cat) return { title: "Not found | AuditHalo" };
  const url = `${BASE}/docs/${category}`;
  return {
    title: `${cat.title} | AuditHalo docs`,
    description: cat.description,
    alternates: { canonical: url },
  };
}

export default async function DocsCategoryPage({ params }: { params: Params }) {
  const { category } = await params;
  const cat = DOC_CATEGORIES.find((c) => c.slug === category);
  if (!cat) notFound();

  const nav = buildDocsNav(getAllDocs());
  const navCat = nav.find((c) => c.slug === category);

  return (
    <section>
      <DocsBreadcrumbs
        crumbs={[{ name: "Docs", href: "/docs" }, { name: cat.title }]}
      />
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-[1.15]">
        {cat.title}
      </h1>
      <p className="mt-4 text-lg text-[color:var(--ink-600)] leading-relaxed max-w-2xl">
        {cat.description}
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4">
        {(navCat?.articles ?? []).map((a) => (
          <Link key={a.path} href={`/docs/${a.path}`} className="block group">
            <Card className="transition-colors group-hover:border-[color:var(--ink-400)]">
              <CardContent className="p-5 flex items-center justify-between gap-3">
                <span className="font-medium text-foreground group-hover:text-[color:var(--ink-700)]">
                  {a.title}
                </span>
                <ArrowRight className="h-4 w-4 text-[color:var(--ink-900)] shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {(!navCat || navCat.articles.length === 0) && (
          <p className="text-[color:var(--ink-500)]">
            Articles for this section are coming soon.
          </p>
        )}
      </div>
    </section>
  );
}
