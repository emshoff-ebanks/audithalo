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
    // First article overall (getting-started/supervisor) has no previous,
    // and its next is the first article of the following category.
    const first = getAdjacentDocs(docs, "getting-started/supervisor");
    expect(first.prev).toBeNull();
    expect(first.next).toEqual({
      path: "sessions/log-and-sign-a-session",
      title: "How to log and sign a supervision session",
    });

    // Last article overall has a previous and no next.
    const last = getAdjacentDocs(docs, "sessions/log-and-sign-a-session");
    expect(last.prev).toEqual({
      path: "getting-started/supervisor",
      title: "Getting started as a supervisor",
    });
    expect(last.next).toBeNull();
  });

  it("returns both null for an unknown path", () => {
    const { prev, next } = getAdjacentDocs(getAllDocs(), "nope/missing");
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });
});
