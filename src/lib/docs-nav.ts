import type { DocArticle } from "@/lib/docs";

export interface DocCategory {
  slug: string;
  title: string;
  description: string;
  audience: string;
}

// Stable taxonomy. Categories render in this order. Slugs must match the
// directory names under src/content/docs/ and each article's `category`.
export const DOC_CATEGORIES: DocCategory[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Role-by-role first steps for supervisors, supervisees, HR admins, and executives.",
    audience: "All roles",
  },
  {
    slug: "sessions",
    title: "Sessions & Signing",
    description: "Logging supervision sessions, scheduling, AI-assisted notes, and the sign-and-seal flow.",
    audience: "Supervisor, Supervisee",
  },
  {
    slug: "practice-hours",
    title: "Practice Hours",
    description: "Logging practice hours and the supervisor approval queue.",
    audience: "Supervisor, Supervisee",
  },
  {
    slug: "rules",
    title: "State Rules & Compliance",
    description: "How the rules engine works, compliance status, gaps, overrides, and versions.",
    audience: "Supervisor, HR Admin",
  },
  {
    slug: "evidence",
    title: "Evidence Packages",
    description: "How evidence packages are generated, downloaded, and independently verified.",
    audience: "All roles",
  },
  {
    slug: "team",
    title: "Team & Roster",
    description: "Invites, roster management, reassignment, leave status, and CSV import.",
    audience: "HR Admin, Supervisor",
  },
  {
    slug: "integrations",
    title: "Calendar & Integrations",
    description: "Microsoft and Google calendar OAuth, recurring sessions, and Paycor.",
    audience: "Supervisor, HR Admin",
  },
  {
    slug: "billing",
    title: "Billing & Plans",
    description: "Solo, Practice, and Enterprise plans, trials, upgrades, and the Stripe portal.",
    audience: "Supervisor, HR Admin",
  },
  {
    slug: "account",
    title: "Account & Security",
    description: "Two-factor authentication, passwords, email, notifications, and account deletion.",
    audience: "All roles",
  },
  {
    slug: "audit-log",
    title: "Audit Log",
    description: "Reading, exporting, and retaining the organization audit log.",
    audience: "HR Admin, Executive, Supervisor",
  },
];

export function categoryLabel(slug: string): string {
  return DOC_CATEGORIES.find((c) => c.slug === slug)?.title ?? slug;
}

export interface NavCategory extends DocCategory {
  articles: { path: string; title: string; order: number }[];
}

export function buildDocsNav(docs: DocArticle[]): NavCategory[] {
  return DOC_CATEGORIES.map((cat) => ({
    ...cat,
    articles: docs
      .filter((d) => d.meta.category === cat.slug)
      .sort((a, b) => a.meta.order - b.meta.order)
      .map((d) => ({ path: d.path, title: d.meta.title, order: d.meta.order })),
  })).filter((cat) => cat.articles.length > 0);
}

export interface SearchEntry {
  path: string;
  title: string;
  description: string;
  categorySlug: string;
  categoryLabel: string;
  text: string; // lowercased haystack for full-text matching
}

// Strip MDX/markdown noise so the search haystack is readable prose. Hyphens
// are preserved so hyphenated terms (e.g. "audit-log", "sign-and-seal") remain
// searchable.
function stripMdx(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|]/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchIndex(docs: DocArticle[]): SearchEntry[] {
  return docs.map((d) => ({
    path: d.path,
    title: d.meta.title,
    description: d.meta.description,
    categorySlug: d.meta.category,
    categoryLabel: categoryLabel(d.meta.category),
    text: [
      d.meta.title,
      d.meta.description,
      categoryLabel(d.meta.category),
      d.meta.category, // slug, so hyphenated category queries match
      d.path,
      ...(d.meta.keywords ?? []),
      stripMdx(d.content),
    ]
      .join(" ")
      .toLowerCase(),
  }));
}

export interface AdjacentDocs {
  prev: { path: string; title: string } | null;
  next: { path: string; title: string } | null;
}

// Prev/next walk the flattened nav order (category order, then article order).
export function getAdjacentDocs(
  docs: DocArticle[],
  currentPath: string
): AdjacentDocs {
  const flat = buildDocsNav(docs).flatMap((c) => c.articles);
  const i = flat.findIndex((a) => a.path === currentPath);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? { path: flat[i - 1].path, title: flat[i - 1].title } : null,
    next:
      i < flat.length - 1
        ? { path: flat[i + 1].path, title: flat[i + 1].title }
        : null,
  };
}
