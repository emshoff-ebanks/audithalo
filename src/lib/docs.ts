import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { slugify } from "@/lib/slugify";

const DOCS_DIR = path.join(process.cwd(), "src", "content", "docs");

export interface DocHeading {
  level: 2 | 3;
  text: string;
  id: string;
}

/**
 * Extract h2/h3 headings from raw MDX for the "On this page" rail. Fenced code
 * blocks are skipped so a `## comment` inside a code sample isn't mistaken for
 * a heading. Slugs match the ids the MDX heading components render (see
 * mdx-components.tsx), so the anchors line up.
 */
export function extractHeadings(content: string): DocHeading[] {
  const headings: DocHeading[] = [];
  let inFence = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.*)$/.exec(line);
    if (!match) continue;
    const level = match[1].length as 2 | 3;
    const text = match[2].replace(/[*_`]/g, "").trim();
    if (!text) continue;
    headings.push({ level, text, id: slugify(text) });
  }
  return headings;
}

export interface DocMeta {
  title: string;
  description: string;
  category: string;
  audience: string[];
  order: number;
  dateUpdated: string;
  prerequisites?: string[];
  related?: string[];
  keywords?: string[];
  schema: ("Article" | "HowTo" | "FAQPage")[];
  faq?: { q: string; a: string }[];
  howToSteps?: { name: string; text: string }[];
}

export interface DocArticle {
  meta: DocMeta;
  content: string;
  path: string; // "category/slug"
}

export interface DocPath {
  category: string;
  slug: string;
}

export function getAllDocPaths(): DocPath[] {
  if (!fs.existsSync(DOCS_DIR)) return [];
  const paths: DocPath[] = [];
  for (const category of fs.readdirSync(DOCS_DIR)) {
    const catDir = path.join(DOCS_DIR, category);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const file of fs.readdirSync(catDir)) {
      if (!file.endsWith(".mdx")) continue;
      paths.push({ category, slug: file.replace(/\.mdx$/, "") });
    }
  }
  return paths;
}

export function getDocByPath(
  category: string,
  slug: string
): DocArticle | null {
  const filePath = path.join(DOCS_DIR, category, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    meta: {
      title: data.title,
      description: data.description,
      category: data.category ?? category,
      audience: data.audience ?? [],
      order: data.order ?? 999,
      dateUpdated: data.dateUpdated,
      prerequisites: data.prerequisites,
      related: data.related ?? [],
      keywords: data.keywords ?? [],
      schema: data.schema ?? ["Article"],
      faq: data.faq,
      howToSteps: data.howToSteps,
    },
    content,
    path: `${category}/${slug}`,
  };
}

export function getAllDocs(): DocArticle[] {
  return getAllDocPaths()
    .map(({ category, slug }) => getDocByPath(category, slug))
    .filter((d): d is DocArticle => d !== null)
    .sort(
      (a, b) =>
        a.meta.category.localeCompare(b.meta.category) ||
        a.meta.order - b.meta.order
    );
}
