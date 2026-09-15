import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { getAllDocPaths, getDocByPath, getAllDocs } from "@/lib/docs";
import { categoryLabel, getAdjacentDocs } from "@/lib/docs-nav";
import { mdxComponents } from "@/components/mdx/mdx-components";
import { DocsBreadcrumbs } from "@/components/marketing/docs-breadcrumbs";
import {
  articleJsonLd,
  breadcrumbListJsonLd,
  faqPageJsonLd,
  howToJsonLd,
  jsonLdScript,
} from "@/lib/seo";

const BASE = "https://audithalo.com";

type Params = Promise<{ category: string; slug: string }>;

export function generateStaticParams() {
  return getAllDocPaths();
}

export async function generateMetadata({ params }: { params: Params }) {
  const { category, slug } = await params;
  const doc = getDocByPath(category, slug);
  if (!doc) return { title: "Not found | AuditHalo" };
  const url = `${BASE}/docs/${category}/${slug}`;
  return {
    title: `${doc.meta.title} | AuditHalo docs`,
    description: doc.meta.description,
    keywords: doc.meta.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: doc.meta.title,
      description: doc.meta.description,
      url,
      siteName: "AuditHalo",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: doc.meta.title,
      description: doc.meta.description,
    },
  };
}

export default async function DocArticlePage({ params }: { params: Params }) {
  const { category, slug } = await params;
  const doc = getDocByPath(category, slug);
  if (!doc) notFound();

  const url = `${BASE}/docs/${category}/${slug}`;
  const catLabel = categoryLabel(category);
  const { prev, next } = getAdjacentDocs(getAllDocs(), doc.path);

  const relatedDocs = (doc.meta.related ?? [])
    .map((p) => {
      const [c, s] = p.split("/");
      const d = getDocByPath(c, s);
      return d ? { path: d.path, title: d.meta.title } : null;
    })
    .filter((d): d is { path: string; title: string } => d !== null);

  // Structured data is driven by what the article actually contains: every
  // docs page is a TechArticle with breadcrumbs; HowTo and FAQPage are added
  // when the frontmatter provides steps or FAQs.
  const jsonLd: object[] = [
    breadcrumbListJsonLd([
      { name: "Home", url: BASE },
      { name: "Docs", url: `${BASE}/docs` },
      { name: catLabel, url: `${BASE}/docs/${category}` },
      { name: doc.meta.title, url },
    ]),
    articleJsonLd({
      headline: doc.meta.title,
      description: doc.meta.description,
      url,
      datePublished: doc.meta.dateUpdated,
      dateModified: doc.meta.dateUpdated,
      type: "TechArticle",
      mainEntityOfPage: url,
      keywords: doc.meta.keywords,
    }),
  ];
  if (doc.meta.faq?.length) {
    jsonLd.push(faqPageJsonLd(doc.meta.faq));
  }
  if (doc.meta.howToSteps?.length) {
    jsonLd.push(
      howToJsonLd({
        name: doc.meta.title,
        description: doc.meta.description,
        steps: doc.meta.howToSteps,
      })
    );
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(jsonLd)}
      />

      <article className="max-w-3xl">
        <DocsBreadcrumbs
          crumbs={[
            { name: "Docs", href: "/docs" },
            { name: catLabel, href: `/docs/${category}` },
            { name: doc.meta.title },
          ]}
        />

        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-[1.15]">
          {doc.meta.title}
        </h1>
        <p className="mt-4 text-lg text-foreground/75 leading-relaxed">
          {doc.meta.description}
        </p>
        {doc.meta.dateUpdated && (
          <p className="mt-3 font-mono text-xs text-foreground/50">
            Last updated {format(parseISO(doc.meta.dateUpdated), "MMM d, yyyy")}
          </p>
        )}

        {doc.meta.prerequisites && doc.meta.prerequisites.length > 0 && (
          <div className="mt-8 rounded-sm border border-border bg-evidence-bg/50 p-5">
            <p className="label-overline mb-2">What you&rsquo;ll need</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
              {doc.meta.prerequisites.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10">
          <MDXRemote
            source={doc.content}
            components={mdxComponents}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
          />
        </div>

        {relatedDocs.length > 0 && (
          <div className="mt-14 border-t border-border pt-8">
            <p className="label-overline mb-3">Related articles</p>
            <ul className="space-y-2">
              {relatedDocs.map((r) => (
                <li key={r.path}>
                  <Link
                    href={`/docs/${r.path}`}
                    className="inline-flex items-center gap-1.5 text-secondary hover:underline"
                  >
                    {r.title} <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <nav className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {prev ? (
            <Link
              href={`/docs/${prev.path}`}
              className="group rounded-sm border border-border p-4 hover:border-secondary/50"
            >
              <span className="inline-flex items-center gap-1.5 text-xs text-foreground/50">
                <ArrowLeft className="h-3 w-3" /> Previous
              </span>
              <span className="mt-1 block font-medium text-foreground group-hover:text-secondary">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/docs/${next.path}`}
              className="group rounded-sm border border-border p-4 text-right hover:border-secondary/50 sm:col-start-2"
            >
              <span className="inline-flex items-center gap-1.5 text-xs text-foreground/50">
                Next <ArrowRight className="h-3 w-3" />
              </span>
              <span className="mt-1 block font-medium text-foreground group-hover:text-secondary">
                {next.title}
              </span>
            </Link>
          )}
        </nav>
      </article>

      {doc.meta.faq && doc.meta.faq.length > 0 && (
        <section className="max-w-3xl mt-14 border-t border-border pt-10">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-6">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {doc.meta.faq.map((item, i) => (
              <div key={i}>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {item.q}
                </h3>
                <p className="mt-2 text-foreground/80 leading-relaxed">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
