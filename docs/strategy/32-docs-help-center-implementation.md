# Docs / Help Center Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2 infrastructure for an SSG help center at `audithalo.com/docs` — content loader, routes (index / category / article), responsive sidebar, breadcrumbs, prev/next, reusable article template, client-side full-text search, schema markup, sitemap integration, and in-app help links — with no article content written (that is Phase 3).

**Architecture:** Mirror the existing `/blog` implementation. MDX files live under `src/content/docs/<category>/<article>.mdx`; a `src/lib/docs.ts` loader parses frontmatter with `gray-matter` and returns typed objects. Category order/titles are declared in code (`src/lib/docs-nav.ts`) so the taxonomy is stable even before articles exist; articles are discovered from the filesystem and slotted into their category. Pages render with `next-mdx-remote/rsc` + the existing `mdxComponents`. Search is a client component fed a server-built index. Two scaffold MDX files are seeded so routes render and tests pass; Phase 3 replaces/expands them.

**Tech Stack:** Next.js 16 App Router (SSG), React 19, TypeScript 5 strict, Tailwind 4, `gray-matter`, `next-mdx-remote` v6, `remark-gfm`, `reading-time`, `date-fns`, Vitest 4, lucide-react, shadcn UI layer in `src/components/ui/`.

**Spec:** `docs/strategy/31-docs-help-center-plan.md`. Read it before starting.

**Conventions (from AGENTS.md / HANDOFF.md):**
- Git identity is already correct (`emshoff-ebanks` / `228783329+emshoff-ebanks@users.noreply.github.com`). Do not touch `--global`.
- Commit per task on the current branch. Do NOT `git push` — Caleb reviews the diff first.
- Verification before declaring done: `npm test`, `npm run lint`, `npm run build`, and exercise `/docs` in a browser (`npm run dev`, localhost:3000 serves the marketing host).
- No emoji anywhere. Sentence-case headings. Match surrounding code style.

---

## File Structure

**Create:**
- `src/lib/docs.ts` — MDX loader + `DocMeta`/`DocArticle` types. One responsibility: read `src/content/docs/**` and return typed articles.
- `src/lib/docs-nav.ts` — `DOC_CATEGORIES` ordered config (slug, title, description, audience) + pure helpers that combine categories with discovered articles into a nav tree, build the search index, and compute prev/next. No filesystem access beyond calling `docs.ts`.
- `src/lib/docs-help-map.ts` — `ROUTE_HELP_MAP` (dashboard route prefix → doc path) + `helpLinkForRoute(pathname)` returning a `/docs/...` URL (falls back to `/docs`).
- `src/content/docs/getting-started/supervisor.mdx` — scaffold article (real frontmatter, short placeholder body).
- `src/content/docs/sessions/log-and-sign-a-session.mdx` — scaffold article.
- `src/app/marketing/docs/layout.tsx` — shell: breadcrumb slot + responsive sidebar + search, wrapping all docs routes.
- `src/app/marketing/docs/page.tsx` — index: getting-started cards + category grid.
- `src/app/marketing/docs/[category]/page.tsx` — category landing (lists that category's articles).
- `src/app/marketing/docs/[category]/[slug]/page.tsx` — article page (template + schema + prev/next + related).
- `src/components/marketing/docs-sidebar.tsx` — client component: category groups, active-item highlight, mobile collapse.
- `src/components/marketing/docs-search.tsx` — client component: search input + results list over the prebuilt index.
- `src/components/marketing/docs-breadcrumbs.tsx` — server component rendering a breadcrumb trail.
- `tests/lib/docs.test.ts` — loader tests.
- `tests/lib/docs-nav.test.ts` — nav/search/prev-next helper tests.
- `tests/lib/docs-help-map.test.ts` — contextual help map tests.

**Modify:**
- `src/app/sitemap.ts` — append docs index, category, and article URLs.
- `src/app/marketing/layout.tsx` — add "Docs" to header nav + footer Product list.
- `src/components/marketing/mobile-nav.tsx` — add "Docs" to mobile nav list.
- `src/app/app/layout.tsx` — add a Help link (opens `/docs` in a new tab) in the app header.

**Frontmatter shape** (`DocMeta`) used by every `.mdx` under `src/content/docs/`:
```yaml
title: string            # H1 + nav label + <title>
description: string      # meta description + card/sidebar subtitle + search text
category: string         # MUST match a DOC_CATEGORIES slug
audience: string[]       # e.g. ["supervisor","supervisee"] (display only)
order: number            # sort order within the category (ascending)
dateUpdated: string      # ISO date, shown as "Last updated"
prerequisites?: string[] # "What you'll need" bullets
related?: string[]       # doc paths like "sessions/ai-session-notes"
keywords?: string[]      # extra search terms
schema?: ("Article"|"HowTo"|"FAQPage")[]  # default ["Article"]
faq?: { q: string; a: string }[]
howToSteps?: { name: string; text: string }[]
```

---

## Task 1: Docs content loader (`src/lib/docs.ts`)

**Files:**
- Create: `src/content/docs/getting-started/supervisor.mdx`
- Create: `src/content/docs/sessions/log-and-sign-a-session.mdx`
- Create: `src/lib/docs.ts`
- Test: `tests/lib/docs.test.ts`

- [ ] **Step 1: Create the two scaffold MDX files**

`src/content/docs/getting-started/supervisor.mdx`:
```mdx
---
title: Getting started as a supervisor
description: Create your account, invite your first supervisee, assign a state rule, and sign your first supervision session.
category: getting-started
audience: ["supervisor"]
order: 1
dateUpdated: "2026-09-14"
prerequisites: ["A work email address", "The state whose rule your supervisee follows"]
related: ["sessions/log-and-sign-a-session"]
keywords: ["signup", "register", "onboarding", "first steps"]
schema: ["Article"]
---

This guide is a Phase 2 scaffold. Content is written in Phase 3.

## Create your account

Placeholder body so the route renders and search has text to index.
```

`src/content/docs/sessions/log-and-sign-a-session.mdx`:
```mdx
---
title: How to log and sign a supervision session
description: Log a supervision session, sign it with intent, and collect the supervisee countersignature that seals the evidence package.
category: sessions
audience: ["supervisor", "supervisee"]
order: 1
dateUpdated: "2026-09-14"
prerequisites: ["A supervisee assigned to you", "A completed supervision meeting"]
related: ["getting-started/supervisor"]
keywords: ["sign", "signature", "seal", "evidence"]
schema: ["Article"]
---

This guide is a Phase 2 scaffold. Content is written in Phase 3.

## Log the session

Placeholder body so the route renders and search has text to index.
```

- [ ] **Step 2: Write the failing test**

`tests/lib/docs.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  getAllDocPaths,
  getDocByPath,
  getAllDocs,
} from "@/lib/docs";

describe("docs loader", () => {
  it("getAllDocPaths returns category/slug pairs for every mdx file", () => {
    const paths = getAllDocPaths();
    expect(paths).toContainEqual({
      category: "getting-started",
      slug: "supervisor",
    });
    expect(paths).toContainEqual({
      category: "sessions",
      slug: "log-and-sign-a-session",
    });
  });

  it("getDocByPath parses frontmatter and body", () => {
    const doc = getDocByPath("getting-started", "supervisor");
    expect(doc).not.toBeNull();
    expect(doc!.meta.title).toBe("Getting started as a supervisor");
    expect(doc!.meta.category).toBe("getting-started");
    expect(doc!.meta.order).toBe(1);
    expect(doc!.meta.related).toContain("sessions/log-and-sign-a-session");
    expect(doc!.content).toContain("Placeholder body");
  });

  it("getDocByPath returns null for a missing file", () => {
    expect(getDocByPath("getting-started", "does-not-exist")).toBeNull();
  });

  it("getAllDocs returns every doc with a computed path field", () => {
    const docs = getAllDocs();
    const supervisor = docs.find((d) => d.meta.title.includes("supervisor"));
    expect(supervisor?.path).toBe("getting-started/supervisor");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/lib/docs.test.ts`
Expected: FAIL — `Cannot find module '@/lib/docs'`.

- [ ] **Step 4: Implement `src/lib/docs.ts`**

```ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const DOCS_DIR = path.join(process.cwd(), "src", "content", "docs");

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
    .filter((d): d is DocArticle => d !== null);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/lib/docs.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/docs.ts src/content/docs tests/lib/docs.test.ts
git commit -m "feat(docs): MDX content loader + scaffold articles"
```

---

## Task 2: Category config + nav/search/prev-next helpers (`src/lib/docs-nav.ts`)

**Files:**
- Create: `src/lib/docs-nav.ts`
- Test: `tests/lib/docs-nav.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/docs-nav.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  DOC_CATEGORIES,
  buildDocsNav,
  buildSearchIndex,
  getAdjacentDocs,
} from "@/lib/docs-nav";
import { getAllDocs } from "@/lib/docs";

describe("DOC_CATEGORIES", () => {
  it("has 10 categories with unique slugs in a stable order", () => {
    expect(DOC_CATEGORIES).toHaveLength(10);
    const slugs = DOC_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(10);
    expect(slugs[0]).toBe("getting-started");
  });
});

describe("buildDocsNav", () => {
  it("groups docs under their category in category order, articles sorted by order", () => {
    const nav = buildDocsNav(getAllDocs());
    expect(nav[0].slug).toBe("getting-started");
    const gs = nav.find((c) => c.slug === "getting-started");
    expect(gs!.articles[0].path).toBe("getting-started/supervisor");
  });

  it("omits categories that have no articles yet", () => {
    const nav = buildDocsNav(getAllDocs());
    // audit-log has no scaffold article, so it must not appear.
    expect(nav.some((c) => c.slug === "audit-log")).toBe(false);
  });
});

describe("buildSearchIndex", () => {
  it("includes title, description, category label, and body text", () => {
    const index = buildSearchIndex(getAllDocs());
    const entry = index.find((e) => e.path === "getting-started/supervisor");
    expect(entry).toBeDefined();
    expect(entry!.title).toBe("Getting started as a supervisor");
    expect(entry!.text.toLowerCase()).toContain("placeholder body");
    expect(entry!.categoryLabel).toBe("Getting Started");
  });
});

describe("getAdjacentDocs", () => {
  it("returns prev/null and next within the same category by order", () => {
    const docs = getAllDocs();
    const { prev, next } = getAdjacentDocs(docs, "getting-started/supervisor");
    expect(prev).toBeNull(); // only one getting-started scaffold, order 1
    expect(next).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/docs-nav.test.ts`
Expected: FAIL — `Cannot find module '@/lib/docs-nav'`.

- [ ] **Step 3: Implement `src/lib/docs-nav.ts`**

```ts
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

// Strip MDX/markdown noise so the search haystack is readable prose.
function stripMdx(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|-]/g, " ")
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/docs-nav.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/docs-nav.ts tests/lib/docs-nav.test.ts
git commit -m "feat(docs): category config + nav, search-index, prev/next helpers"
```

---

## Task 3: Contextual in-app help map (`src/lib/docs-help-map.ts`)

**Files:**
- Create: `src/lib/docs-help-map.ts`
- Test: `tests/lib/docs-help-map.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/docs-help-map.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { helpLinkForRoute, DOCS_BASE_URL } from "@/lib/docs-help-map";

describe("helpLinkForRoute", () => {
  it("maps the rules admin route to the overrides article", () => {
    expect(helpLinkForRoute("/dashboard/team/rules")).toBe(
      `${DOCS_BASE_URL}/rules/creating-rule-overrides`
    );
  });

  it("matches the most specific prefix when routes are nested", () => {
    expect(helpLinkForRoute("/dashboard/team/import")).toBe(
      `${DOCS_BASE_URL}/team/bulk-csv-import`
    );
    expect(helpLinkForRoute("/dashboard/team")).toBe(
      `${DOCS_BASE_URL}/team/inviting-team-members`
    );
  });

  it("matches dynamic segments by prefix", () => {
    expect(helpLinkForRoute("/sign/abc-123")).toBe(
      `${DOCS_BASE_URL}/sessions/log-and-sign-a-session`
    );
  });

  it("falls back to the docs index for unmapped routes", () => {
    expect(helpLinkForRoute("/dashboard/something-new")).toBe(DOCS_BASE_URL);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/docs-help-map.test.ts`
Expected: FAIL — `Cannot find module '@/lib/docs-help-map'`.

- [ ] **Step 3: Implement `src/lib/docs-help-map.ts`**

```ts
// Docs live on the marketing host; the app runs on app.audithalo.com. Use an
// absolute URL so contextual help links resolve across hosts, and open them in
// a new tab at the call site so dashboard state is preserved.
export const DOCS_BASE_URL = "https://audithalo.com/docs";

// Ordered most-specific-first. helpLinkForRoute picks the first prefix match,
// so nested routes (…/team/import) must precede their parents (…/team).
const ROUTE_HELP_MAP: { prefix: string; doc: string }[] = [
  { prefix: "/dashboard/team/rules", doc: "rules/creating-rule-overrides" },
  { prefix: "/dashboard/team/import", doc: "team/bulk-csv-import" },
  { prefix: "/dashboard/team", doc: "team/inviting-team-members" },
  { prefix: "/dashboard/roster", doc: "rules/understanding-compliance-status" },
  { prefix: "/dashboard/calendar", doc: "integrations/using-the-calendar" },
  { prefix: "/dashboard/executive", doc: "getting-started/executive" },
  { prefix: "/dashboard/billing", doc: "billing/managing-your-subscription" },
  { prefix: "/dashboard/audit-log", doc: "audit-log/reading-the-audit-log" },
  { prefix: "/dashboard/settings/integrations", doc: "integrations/connecting-paycor" },
  { prefix: "/dashboard/settings", doc: "getting-started/hr-admin" },
  { prefix: "/dashboard/account", doc: "account/two-factor-authentication" },
  { prefix: "/sign/", doc: "sessions/log-and-sign-a-session" },
];

export function helpLinkForRoute(pathname: string): string {
  const match = ROUTE_HELP_MAP.find((m) => pathname.startsWith(m.prefix));
  return match ? `${DOCS_BASE_URL}/${match.doc}` : DOCS_BASE_URL;
}
```

Note: the `settings/integrations` entry is intentionally listed after `settings` in source but `startsWith("/dashboard/settings")` would match `/dashboard/settings/integrations` first only if it precedes. Fix ordering: ensure `/dashboard/settings/integrations` appears BEFORE `/dashboard/settings`. Update the array so the integrations line comes first. (Corrected array below is authoritative.)

Authoritative array ordering (replace the two settings lines with this order):
```ts
  { prefix: "/dashboard/settings/integrations", doc: "integrations/connecting-paycor" },
  { prefix: "/dashboard/settings", doc: "getting-started/hr-admin" },
```
Place both immediately after the `/dashboard/calendar` entry and before `/dashboard/executive` is fine — only relative order of the two `settings` prefixes matters (specific before general).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/docs-help-map.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/docs-help-map.ts tests/lib/docs-help-map.test.ts
git commit -m "feat(docs): contextual in-app help route map"
```

---

## Task 4: Breadcrumbs component (`src/components/marketing/docs-breadcrumbs.tsx`)

**Files:**
- Create: `src/components/marketing/docs-breadcrumbs.tsx`

- [ ] **Step 1: Implement the component**

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  name: string;
  href?: string; // last crumb has no href (current page)
}

export function DocsBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-foreground/60">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3 text-foreground/30" />}
            {c.href ? (
              <Link href={c.href} className="hover:text-foreground transition-colors">
                {c.name}
              </Link>
            ) : (
              <span className="text-foreground/80">{c.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json` (or rely on the Task 9 build). Expected: no new errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/docs-breadcrumbs.tsx
git commit -m "feat(docs): breadcrumbs component"
```

---

## Task 5: Search component (`src/components/marketing/docs-search.tsx`)

**Files:**
- Create: `src/components/marketing/docs-search.tsx`

- [ ] **Step 1: Implement the client search component**

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SearchEntry } from "@/lib/docs-nav";

export function DocsSearch({ index }: { index: SearchEntry[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return [];
    return index
      .filter((e) => e.text.includes(q))
      .slice(0, 8);
  }, [index, q]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the docs"
          aria-label="Search the docs"
          className="pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-foreground/40 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {q && (
        <div className="absolute z-40 mt-2 w-full rounded-sm border border-border bg-card shadow-md">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-foreground/60">
              No articles match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto py-1">
              {results.map((r) => (
                <li key={r.path}>
                  <Link
                    href={`/docs/${r.path}`}
                    className="block px-4 py-2.5 hover:bg-evidence-bg/60"
                    onClick={() => setQuery("")}
                  >
                    <span className="block text-sm font-medium text-foreground">
                      {r.title}
                    </span>
                    <span className="block text-xs text-foreground/60">
                      {r.categoryLabel}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Confirm the `Input` import path exists**

Run: `test -f src/components/ui/input.tsx && echo OK`
Expected: `OK` (used by `blog-index-client.tsx`).

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/docs-search.tsx
git commit -m "feat(docs): client-side full-text search component"
```

---

## Task 6: Sidebar component (`src/components/marketing/docs-sidebar.tsx`)

**Files:**
- Create: `src/components/marketing/docs-sidebar.tsx`

- [ ] **Step 1: Implement the responsive sidebar (client, uses `usePathname` for active state)**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { NavCategory } from "@/lib/docs-nav";

function NavList({ nav, pathname, onNavigate }: {
  nav: NavCategory[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-6">
      {nav.map((cat) => (
        <div key={cat.slug}>
          <Link
            href={`/docs/${cat.slug}`}
            onClick={onNavigate}
            className="label-overline block mb-2 hover:text-foreground"
          >
            {cat.title}
          </Link>
          <ul className="space-y-1 border-l border-border">
            {cat.articles.map((a) => {
              const href = `/docs/${a.path}`;
              const active = pathname === href;
              return (
                <li key={a.path}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`-ml-px block border-l-2 pl-3 py-1 text-sm transition-colors ${
                      active
                        ? "border-secondary text-secondary font-medium"
                        : "border-transparent text-foreground/70 hover:text-foreground hover:border-foreground/30"
                    }`}
                  >
                    {a.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar({ nav }: { nav: NavCategory[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="lg:hidden inline-flex items-center gap-2 text-sm font-medium text-foreground/70 mb-4"
        aria-expanded={open}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        Browse docs
      </button>

      {open && (
        <div className="lg:hidden mb-8 border-b border-border pb-8">
          <NavList nav={nav} pathname={pathname} onNavigate={() => setOpen(false)} />
        </div>
      )}

      {/* Desktop sticky sidebar */}
      <div className="hidden lg:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-auto pr-4">
        <NavList nav={nav} pathname={pathname} />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/marketing/docs-sidebar.tsx
git commit -m "feat(docs): responsive grouped sidebar with active-item highlight"
```

---

## Task 7: Docs layout shell (`src/app/marketing/docs/layout.tsx`)

**Files:**
- Create: `src/app/marketing/docs/layout.tsx`

- [ ] **Step 1: Implement the layout**

```tsx
import { getAllDocs } from "@/lib/docs";
import { buildDocsNav, buildSearchIndex } from "@/lib/docs-nav";
import { DocsSidebar } from "@/components/marketing/docs-sidebar";
import { DocsSearch } from "@/components/marketing/docs-search";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = getAllDocs();
  const nav = buildDocsNav(docs);
  const index = buildSearchIndex(docs);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
      <div className="mb-8 max-w-md">
        <DocsSearch index={index} />
      </div>
      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-12">
        <aside>
          <DocsSidebar nav={nav} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/marketing/docs/layout.tsx
git commit -m "feat(docs): docs layout shell (sidebar + search)"
```

---

## Task 8: Docs index, category, and article pages

**Files:**
- Create: `src/app/marketing/docs/page.tsx`
- Create: `src/app/marketing/docs/[category]/page.tsx`
- Create: `src/app/marketing/docs/[category]/[slug]/page.tsx`

- [ ] **Step 1: Implement the index page (`src/app/marketing/docs/page.tsx`)**

Getting-started cards pulled out above the category grid, per spec.
```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAllDocs } from "@/lib/docs";
import { buildDocsNav } from "@/lib/docs-nav";
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
  const rest = nav.filter((c) => c.slug !== "getting-started");

  return (
    <section>
      <Badge variant="outline" className="mb-6">
        Help center
      </Badge>
      <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground leading-[1.1]">
        Documentation.
      </h1>
      <p className="mt-6 text-lg text-foreground/75 leading-relaxed max-w-2xl">
        Everything you need to run audit-ready supervision, organized by task.
        New here? Start with the guide for your role.
      </p>

      {gettingStarted && gettingStarted.articles.length > 0 && (
        <div className="mt-12">
          <p className="label-overline mb-4">Start here</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gettingStarted.articles.map((a) => (
              <Link key={a.path} href={`/docs/${a.path}`} className="block group">
                <Card className="h-full transition-colors group-hover:border-secondary/50">
                  <CardContent className="p-5 flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground group-hover:text-secondary">
                      {a.title}
                    </span>
                    <ArrowRight className="h-4 w-4 text-secondary shrink-0" />
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
            <Link key={cat.slug} href={`/docs/${cat.slug}`} className="block group h-full">
              <Card className="h-full transition-colors group-hover:border-secondary/50">
                <CardContent className="p-6">
                  <h2 className="font-display text-lg font-semibold text-foreground group-hover:text-secondary">
                    {cat.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-foreground/70 leading-relaxed">
                    {cat.description}
                  </p>
                  <p className="mt-3 text-xs text-foreground/50">
                    {cat.articles.length} article{cat.articles.length === 1 ? "" : "s"}
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
```

- [ ] **Step 2: Implement the category page (`src/app/marketing/docs/[category]/page.tsx`)**

```tsx
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
        crumbs={[
          { name: "Docs", href: "/docs" },
          { name: cat.title },
        ]}
      />
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-[1.15]">
        {cat.title}
      </h1>
      <p className="mt-4 text-lg text-foreground/75 leading-relaxed max-w-2xl">
        {cat.description}
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4">
        {(navCat?.articles ?? []).map((a) => (
          <Link key={a.path} href={`/docs/${a.path}`} className="block group">
            <Card className="transition-colors group-hover:border-secondary/50">
              <CardContent className="p-5 flex items-center justify-between gap-3">
                <span className="font-medium text-foreground group-hover:text-secondary">
                  {a.title}
                </span>
                <ArrowRight className="h-4 w-4 text-secondary shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {(!navCat || navCat.articles.length === 0) && (
          <p className="text-foreground/60">
            Articles for this section are coming soon.
          </p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Implement the article page (`src/app/marketing/docs/[category]/[slug]/page.tsx`)**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { getAllDocPaths, getDocByPath, getAllDocs } from "@/lib/docs";
import {
  categoryLabel,
  getAdjacentDocs,
} from "@/lib/docs-nav";
import { mdxComponents } from "@/components/mdx/mdx-components";
import { DocsBreadcrumbs } from "@/components/marketing/docs-breadcrumbs";
import { FaqSection } from "@/components/marketing/faq-section";
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
    alternates: { canonical: url },
    openGraph: {
      title: doc.meta.title,
      description: doc.meta.description,
      url,
      siteName: "AuditHalo",
      type: "article",
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

  const jsonLd: object[] = [
    breadcrumbListJsonLd([
      { name: "Home", url: BASE },
      { name: "Docs", url: `${BASE}/docs` },
      { name: catLabel, url: `${BASE}/docs/${category}` },
      { name: doc.meta.title, url },
    ]),
  ];
  if (doc.meta.schema.includes("Article")) {
    jsonLd.push(
      articleJsonLd({
        headline: doc.meta.title,
        description: doc.meta.description,
        url,
        datePublished: doc.meta.dateUpdated,
      })
    );
  }
  if (doc.meta.schema.includes("FAQPage") && doc.meta.faq?.length) {
    jsonLd.push(faqPageJsonLd(doc.meta.faq));
  }
  if (doc.meta.schema.includes("HowTo") && doc.meta.howToSteps?.length) {
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
        <div className="max-w-3xl">
          <FaqSection items={doc.meta.faq} />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Confirm the `FaqSection` import exists**

Run: `test -f src/components/marketing/faq-section.tsx && echo OK`
Expected: `OK` (used by the blog article page).

- [ ] **Step 5: Commit**

```bash
git add src/app/marketing/docs/page.tsx "src/app/marketing/docs/[category]/page.tsx" "src/app/marketing/docs/[category]/[slug]/page.tsx"
git commit -m "feat(docs): index, category, and article pages with schema markup"
```

---

## Task 9: Sitemap integration (`src/app/sitemap.ts`)

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Add imports and docs entries**

At the top, alongside the existing imports, add:
```ts
import { getAllDocs } from "@/lib/docs";
import { DOC_CATEGORIES } from "@/lib/docs-nav";
```

Add `"/docs"` to the `STATIC_PATHS` array (after `"/blog"`).

Before the final `return`, add:
```ts
  const docsCategoryEntries: MetadataRoute.Sitemap = DOC_CATEGORIES.map((c) => ({
    url: `${BASE}/docs/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const docsArticleEntries: MetadataRoute.Sitemap = getAllDocs().map((d) => ({
    url: `${BASE}/docs/${d.path}`,
    lastModified: d.meta.dateUpdated ? new Date(d.meta.dateUpdated) : now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
```

Change the return to:
```ts
  return [
    ...staticEntries,
    ...stateEntries,
    ...blogEntries,
    ...docsCategoryEntries,
    ...docsArticleEntries,
  ];
```

- [ ] **Step 2: Verify sitemap builds and includes docs**

Run: `npm run build` then inspect the generated sitemap: `node -e "require('fs')" ` is not enough — instead run dev and curl:
Run: `npm run dev` (background), then `curl -s http://localhost:3000/sitemap.xml | grep -c "/docs"`
Expected: at least 3 (index + 10 categories + 2 scaffold articles = 13). Stop dev after.

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(docs): add docs index, categories, and articles to sitemap"
```

---

## Task 10: In-app + marketing help links

**Files:**
- Modify: `src/app/marketing/layout.tsx`
- Modify: `src/components/marketing/mobile-nav.tsx`
- Modify: `src/app/app/layout.tsx`

- [ ] **Step 1: Add "Docs" to the marketing header nav**

In `src/app/marketing/layout.tsx`, add to the `navLinks` array after the `/blog` entry:
```ts
  { href: "/docs", label: "Docs" },
```

- [ ] **Step 2: Add "Docs" to the marketing footer Product list**

In the footer `Product` `<ul>` (after the Guides `<li>`), add:
```tsx
              <li>
                <Link href="/docs" className="hover:text-foreground">
                  Docs
                </Link>
              </li>
```

- [ ] **Step 3: Add "Docs" to the mobile nav**

In `src/components/marketing/mobile-nav.tsx`, add to its `navLinks` array (after `/for-group-practices` or at the end before `/security`):
```ts
  { href: "/docs", label: "Docs" },
```

- [ ] **Step 4: Add a Help link to the app header**

In `src/app/app/layout.tsx`, import an icon and add a Help link next to the notifications bell. Change the imports to add:
```ts
import { HelpCircle } from "lucide-react";
```
Then inside the authenticated `<div className="flex items-center gap-2">`, BEFORE `<NotificationsBell .../>`, add:
```tsx
              <a
                href="https://audithalo.com/docs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Help and documentation"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 hover:text-foreground px-2 py-1"
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Help</span>
              </a>
```

Note: the app runs on `app.audithalo.com`; docs live on the marketing host, so use the absolute `https://audithalo.com/docs` URL and `target="_blank"` to preserve dashboard state. (In local dev the app and marketing share `localhost:3000` via proxy, so the absolute prod URL is correct for shipped behavior; do not swap it for a relative path.)

- [ ] **Step 5: Verify build + lint**

Run: `npm run lint`
Expected: no new warnings on the four modified files.

- [ ] **Step 6: Commit**

```bash
git add src/app/marketing/layout.tsx src/components/marketing/mobile-nav.tsx src/app/app/layout.tsx
git commit -m "feat(docs): link to docs from marketing nav/footer and app header"
```

---

## Task 11: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the test suite**

Run: `npm test`
Expected: all prior tests still pass, plus the new `docs.test.ts` (4), `docs-nav.test.ts` (6), `docs-help-map.test.ts` (4). No failures.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean (no new warnings).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `validate:rules` prebuild passes; `/docs`, `/docs/[category]`, and `/docs/[category]/[slug]` appear as statically generated routes in the build output.

- [ ] **Step 4: Exercise in a browser**

Run: `npm run dev`, then visit:
- `http://localhost:3000/docs` — index shows "Start here" (supervisor card) + "Browse by topic" grid (10 categories, most showing "0 articles" except getting-started and sessions).
- `http://localhost:3000/docs/getting-started` — category page lists the supervisor article.
- `http://localhost:3000/docs/getting-started/supervisor` — article renders: breadcrumbs, "Last updated", "What you'll need", body, Related articles (links to the sessions scaffold), prev/next.
- Type "sign" in the search box — the sessions scaffold appears in results; clicking it navigates.
- Resize to mobile width — sidebar collapses behind "Browse docs"; header shows "Docs" via the mobile menu.
- Confirm the marketing header shows "Docs".

Expected: all of the above behave as described. Note any `[Screenshot: ...]` gaps are Phase 3 content concerns, not infra bugs.

- [ ] **Step 5: Report to Caleb**

Summarize: routes built, tests added/passing count, build status, and the browser-exercise result. Do NOT push — Caleb reviews the diff first (AGENTS.md). Then Phase 3 (content writing) is the next, separate pass.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Hosting `/docs` same app, MDX under `src/content/docs`, SSG → Tasks 1, 8 (generateStaticParams).
- Routes index/category/article → Task 8. Layout w/ sidebar → Task 7. Sidebar responsive + grouped → Task 6. Breadcrumbs → Task 4. Prev/next → Tasks 2 + 8. Article template (last-updated, prereqs, related) → Task 8. Search client-side full-text → Tasks 2 (index) + 5 (UI). Schema (Article/HowTo/FAQPage) → Task 8 via `seo.ts`. Sitemap → Task 9. In-app help (nav + dashboard + contextual map) → Tasks 3 + 10.
- IA taxonomy (10 categories) → Task 2 `DOC_CATEGORIES`. Getting-started pulled out of grid → Task 8 index. Fact-integrity for `rules` content → Phase 3 concern, noted in spec §6 (not an infra task).
- Content writing explicitly deferred to Phase 3 → only 2 scaffold files created (Task 1).

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". The scaffold MDX bodies are intentional Phase-2 placeholders, labeled as such, and are the only non-final content.

**Type consistency:** `DocMeta`/`DocArticle`/`DocPath` (Task 1) used consistently in Tasks 2, 8, 9. `NavCategory`/`SearchEntry`/`AdjacentDocs` (Task 2) used in Tasks 5, 6, 7, 8. `Crumb` (Task 4) used in Task 8. `categoryLabel`, `buildDocsNav`, `buildSearchIndex`, `getAdjacentDocs`, `DOC_CATEGORIES` names match across tasks. `helpLinkForRoute`/`DOCS_BASE_URL` (Task 3) — note Task 3 flags a required ordering fix for the two `/dashboard/settings*` prefixes; authoritative ordering is specified inline.

One correction applied inline: the initial `ROUTE_HELP_MAP` draft in Task 3 listed `/dashboard/settings` before `/dashboard/settings/integrations`, which would misroute the integrations page. The authoritative block orders specific-before-general.
