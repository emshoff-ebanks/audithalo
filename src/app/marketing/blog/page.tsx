import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight } from "lucide-react";
import readingTime from "reading-time";
import { getAllBlogPosts } from "@/lib/mdx";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const URL = "https://audithalo.com/blog";

export const metadata = {
  title: "Supervision compliance guides | AuditHalo blog",
  description:
    "Practical, citation-backed guides on clinical supervision hours, board audits, and documentation for mental health supervisors and pre-licensed counselors.",
  alternates: { canonical: URL },
};

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <section className="mx-auto max-w-4xl px-6 py-20 lg:py-24">
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

      <div className="mt-14 space-y-6">
        {posts.map((post) => {
          const stats = readingTime(post.content);
          return (
            <Link
              key={post.meta.slug}
              href={`/blog/${post.meta.slug}`}
              className="block group"
            >
              <Card className="transition-colors group-hover:border-secondary/50">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-foreground/60">
                    <Badge variant="outline">{post.meta.category}</Badge>
                    <span>
                      {format(parseISO(post.meta.datePublished), "MMM d, yyyy")}
                    </span>
                    <span>·</span>
                    <span>{Math.ceil(stats.minutes)} min read</span>
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground group-hover:text-secondary transition-colors">
                    {post.meta.title}
                  </h2>
                  <p className="mt-2 text-foreground/70 leading-relaxed">
                    {post.meta.metaDescription}
                  </p>
                  <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-secondary">
                    Read the guide <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
