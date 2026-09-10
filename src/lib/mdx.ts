import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "src", "content", "blog");

export interface BlogPostMeta {
  title: string;
  metaTitle?: string;
  metaDescription: string;
  slug: string;
  category: string;
  tags: string[];
  datePublished: string;
  dateModified?: string;
  author: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  pillar?: string;
  relatedStates: string[];
  schema: ("Article" | "FAQPage" | "HowTo")[];
  heroImage?: string;
  faq?: { q: string; a: string }[];
  howToSteps?: { name: string; text: string }[];
}

export interface BlogPost {
  meta: BlogPostMeta;
  content: string;
}

export function getAllBlogSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    meta: {
      title: data.title,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      slug: data.slug ?? slug,
      category: data.category,
      tags: data.tags ?? [],
      datePublished: data.datePublished,
      dateModified: data.dateModified,
      author: data.author ?? "AuditHalo",
      primaryKeyword: data.primaryKeyword,
      secondaryKeywords: data.secondaryKeywords ?? [],
      pillar: data.pillar,
      relatedStates: data.relatedStates ?? [],
      schema: data.schema ?? ["Article"],
      heroImage: data.heroImage,
      faq: data.faq,
      howToSteps: data.howToSteps,
    },
    content,
  };
}

export function getAllBlogPosts(): BlogPost[] {
  return getAllBlogSlugs()
    .map((slug) => getBlogPostBySlug(slug))
    .filter((post): post is BlogPost => post !== null)
    .sort(
      (a, b) =>
        new Date(b.meta.datePublished).getTime() -
        new Date(a.meta.datePublished).getTime()
    );
}
