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

  it("omits categories that have no articles", () => {
    // Pass a single doc so only its category survives; every other category
    // is empty and must be dropped. (Uses a synthetic input so the test does
    // not depend on which categories currently have content.)
    const fake = [
      {
        meta: {
          title: "X",
          description: "",
          category: "getting-started",
          audience: [],
          order: 1,
          dateUpdated: "2026-01-01",
          related: [],
          keywords: [],
          schema: ["Article"] as ("Article" | "HowTo" | "FAQPage")[],
        },
        content: "",
        path: "getting-started/x",
      },
    ];
    const nav = buildDocsNav(fake);
    expect(nav).toHaveLength(1);
    expect(nav[0].slug).toBe("getting-started");
    expect(nav.some((c) => c.slug === "audit-log")).toBe(false);
  });
});

describe("buildSearchIndex", () => {
  it("includes title, description, category label, and body text", () => {
    const index = buildSearchIndex(getAllDocs());
    const entry = index.find((e) => e.path === "getting-started/supervisor");
    expect(entry).toBeDefined();
    expect(entry!.title).toBe("Getting started as a supervisor");
    // Body text is indexed: "supervisee" appears in the description and body.
    expect(entry!.text.toLowerCase()).toContain("supervisee");
    expect(entry!.categoryLabel).toBe("Getting Started");
  });

  it("keeps hyphenated terms and the category slug searchable", () => {
    const index = buildSearchIndex(getAllDocs());
    const entry = index.find((e) => e.path === "getting-started/supervisor");
    // The slug and path carry hyphens; stripMdx must not split them.
    expect(entry!.text).toContain("getting-started");
    expect(entry!.text).toContain("getting-started/supervisor");
  });
});

describe("getAdjacentDocs", () => {
  it("walks the flattened nav order across categories", () => {
    const docs = getAllDocs();
    // Derive expectations from the flattened nav so this stays correct as
    // articles are added. prev/next is intentionally global (spans categories).
    const flat = buildDocsNav(docs).flatMap((c) => c.articles);
    expect(flat.length).toBeGreaterThanOrEqual(2);

    const first = flat[0];
    const second = flat[1];
    const last = flat[flat.length - 1];

    const firstAdj = getAdjacentDocs(docs, first.path);
    expect(firstAdj.prev).toBeNull();
    expect(firstAdj.next).toEqual({ path: second.path, title: second.title });

    const lastAdj = getAdjacentDocs(docs, last.path);
    expect(lastAdj.next).toBeNull();
    expect(lastAdj.prev).not.toBeNull();
  });

  it("returns both null for an unknown path", () => {
    const { prev, next } = getAdjacentDocs(getAllDocs(), "nope/missing");
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });
});
