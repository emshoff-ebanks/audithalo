"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowRight, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type BlogIndexPost = {
  slug: string;
  title: string;
  metaDescription: string;
  category: string;
  tags: string[];
  datePublished: string;
  readMinutes: number;
  isPillar: boolean;
};

function PostCard({ post }: { post: BlogIndexPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="block group h-full">
      <Card className="h-full rounded-[14px] border-[color:var(--ink-200)] bg-[color:var(--paper-white)] transition-all group-hover:-translate-y-0.5 group-hover:border-[color:var(--ink-400)]">
        <CardContent className="p-6 sm:p-8 flex h-full flex-col">
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-[color:var(--ink-500)]">
            <Badge variant="outline">{post.category}</Badge>
            <span>{format(parseISO(post.datePublished), "MMM d, yyyy")}</span>
            <span>·</span>
            <span>{post.readMinutes} min read</span>
          </div>
          <h2 className="font-display text-xl font-semibold text-[color:var(--ink-900)] group-hover:text-[color:var(--ink-700)] transition-colors">
            {post.title}
          </h2>
          <p className="mt-2 text-[color:var(--ink-600)] leading-relaxed flex-1">
            {post.metaDescription}
          </p>
          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] uppercase tracking-wide text-[color:var(--ink-500)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--ink-900)]">
            Read the guide <ArrowRight className="h-3.5 w-3.5" />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function BlogIndexClient({
  posts,
  categories,
}: {
  posts: BlogIndexPost[];
  categories: string[];
}) {
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");

  const isFiltering = category !== "All" || query.trim().length > 0;

  const pillars = useMemo(() => posts.filter((p) => p.isPillar), [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (category !== "All" && post.category !== category) return false;
      if (!q) return true;
      const haystack = [post.title, post.metaDescription, ...post.tags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [posts, category, query]);

  const gridPosts = isFiltering
    ? filtered
    : filtered.filter((p) => !p.isPillar);

  return (
    <>
      {!isFiltering && pillars.length > 0 && (
        <div className="mb-14">
          <p className="label-overline mb-4">Start here</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {pillars.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex flex-wrap gap-2">
          {["All", ...categories].map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(cat)}
                className={`inline-flex items-center rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  active
                    ? "bg-[color:var(--ink-900)] text-[color:var(--paper-50)]"
                    : "border border-[color:var(--ink-200)] text-[color:var(--ink-600)] hover:text-[color:var(--ink-900)] hover:border-[color:var(--ink-300)]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--ink-400)]" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides"
            aria-label="Search guides"
            className="pl-9"
          />
        </div>
      </div>

      <p className="text-sm text-[color:var(--ink-500)] mb-6">
        {isFiltering
          ? `Showing ${gridPosts.length} of ${posts.length} guides`
          : `${posts.length} guides`}
      </p>

      {gridPosts.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[color:var(--ink-200)] p-12 text-center">
          <p className="text-[color:var(--ink-600)]">
            No guides match that search or category.
          </p>
          <button
            type="button"
            onClick={() => {
              setCategory("All");
              setQuery("");
            }}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--ink-900)]"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gridPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </>
  );
}
