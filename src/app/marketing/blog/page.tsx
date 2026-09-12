import readingTime from "reading-time";
import { getAllBlogPosts } from "@/lib/mdx";
import { Badge } from "@/components/ui/badge";
import { BlogIndexClient, type BlogIndexPost } from "./blog-index-client";

const URL = "https://audithalo.com/blog";

export const metadata = {
  title: "Supervision compliance guides | AuditHalo blog",
  description:
    "Practical, citation-backed guides on clinical supervision hours, board audits, and documentation for mental health supervisors and pre-licensed counselors.",
  alternates: { canonical: URL },
};

export default function BlogIndexPage() {
  const rawPosts = getAllBlogPosts();

  const pillarSlugs = new Set(
    rawPosts.map((p) => p.meta.pillar).filter((slug): slug is string => Boolean(slug))
  );

  const posts: BlogIndexPost[] = rawPosts.map((post) => ({
    slug: post.meta.slug,
    title: post.meta.title,
    metaDescription: post.meta.metaDescription,
    category: post.meta.category,
    tags: post.meta.tags,
    datePublished: post.meta.datePublished,
    readMinutes: Math.ceil(readingTime(post.content).minutes),
    isPillar: pillarSlugs.has(post.meta.slug),
  }));

  const categories = Array.from(new Set(posts.map((p) => p.category))).sort();

  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
      <Badge variant="outline" className="mb-6">
        Guides
      </Badge>
      <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground leading-[1.1]">
        Supervision compliance guides.
      </h1>
      <p className="mt-6 text-lg text-foreground/75 leading-relaxed max-w-2xl">
        Citation-backed guides on supervision hours, board audits, and
        documentation, written for supervisors and supervisees who need the
        rule itself, not a summary of it.
      </p>

      <div className="mt-14">
        <BlogIndexClient posts={posts} categories={categories} />
      </div>
    </section>
  );
}
