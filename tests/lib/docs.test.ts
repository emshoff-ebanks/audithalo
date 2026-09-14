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
    expect(doc!.content.trim().length).toBeGreaterThan(0);
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
