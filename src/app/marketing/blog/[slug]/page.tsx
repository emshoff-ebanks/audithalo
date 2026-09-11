import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ArrowRight } from "lucide-react";
import readingTime from "reading-time";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { getAllBlogSlugs, getBlogPostBySlug } from "@/lib/mdx";
import { mdxComponents } from "@/components/mdx/mdx-components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FaqSection } from "@/components/marketing/faq-section";
import {
  articleJsonLd,
  breadcrumbListJsonLd,
  faqPageJsonLd,
  howToJsonLd,
  jsonLdScript,
} from "@/lib/seo";

const BASE = "https://audithalo.com";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return { title: "Not found | AuditHalo" };

  const url = `${BASE}/blog/${slug}`;
  const title = post.meta.metaTitle ?? `${post.meta.title} | AuditHalo`;

  return {
    title,
    description: post.meta.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: post.meta.metaDescription,
      url,
      siteName: "AuditHalo",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: post.meta.metaDescription,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  const url = `${BASE}/blog/${slug}`;
  const stats = readingTime(post.content);

  const jsonLd: object[] = [
    breadcrumbListJsonLd([
      { name: "Home", url: BASE },
      { name: "Blog", url: `${BASE}/blog` },
      { name: post.meta.title, url },
    ]),
  ];

  if (post.meta.schema.includes("Article")) {
    jsonLd.push(
      articleJsonLd({
        headline: post.meta.title,
        description: post.meta.metaDescription,
        url,
        datePublished: post.meta.datePublished,
      })
    );
  }

  if (post.meta.schema.includes("FAQPage") && post.meta.faq?.length) {
    jsonLd.push(faqPageJsonLd(post.meta.faq));
  }

  if (post.meta.schema.includes("HowTo") && post.meta.howToSteps?.length) {
    jsonLd.push(
      howToJsonLd({
        name: post.meta.title,
        description: post.meta.metaDescription,
        steps: post.meta.howToSteps,
      })
    );
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(jsonLd)}
      />

      <section className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-6">
          <Link href="/blog">
            <ArrowLeft />
            All guides
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-foreground/60">
          <Badge variant="outline">{post.meta.category}</Badge>
          <span>{format(parseISO(post.meta.datePublished), "MMM d, yyyy")}</span>
          <span>·</span>
          <span>{Math.ceil(stats.minutes)} min read</span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-[1.15]">
          {post.meta.title}
        </h1>
        <p className="mt-5 text-lg text-foreground/75 leading-relaxed">
          {post.meta.metaDescription}
        </p>

        <div className="mt-12">
          <MDXRemote
            source={post.content}
            components={mdxComponents}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
          />
        </div>

        <div className="mt-16 border-t border-border pt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href="https://app.audithalo.com/register">
              Start your supervisor account <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </section>

      {post.meta.faq && post.meta.faq.length > 0 && (
        <FaqSection items={post.meta.faq} />
      )}
    </>
  );
}
