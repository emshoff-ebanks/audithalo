import { describe, it, expect } from "vitest";
import { canonicalize, canonicalJson, sha256Hex } from "@/lib/evidence";

describe("canonicalize", () => {
  it("sorts object keys recursively so insertion order doesn't matter", () => {
    const a = canonicalize({ b: 1, a: { z: 2, y: 1 } });
    const b = canonicalize({ a: { y: 1, z: 2 }, b: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("preserves array element order (arrays are sequences, not sets)", () => {
    const ordered = canonicalize([3, 1, 2]);
    expect(JSON.stringify(ordered)).toBe("[3,1,2]");
  });

  it("handles deeply nested structures", () => {
    const a = canonicalize({ outer: { mid: { inner: [{ b: 2, a: 1 }] } } });
    const b = canonicalize({ outer: { mid: { inner: [{ a: 1, b: 2 }] } } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("passes through scalars unchanged", () => {
    expect(canonicalize(42)).toBe(42);
    expect(canonicalize("x")).toBe("x");
    expect(canonicalize(null)).toBe(null);
    expect(canonicalize(true)).toBe(true);
  });

  it("treats Date as a scalar (does not flatten to {})", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    expect(JSON.stringify(canonicalize(d))).toBe('"2026-01-01T00:00:00.000Z"');
  });
});

describe("canonicalJson + sha256Hex", () => {
  it("produces the same hash for semantically-equal documents with different key order", () => {
    const docA = { rule: { id: "nc-1", version: 1 }, signed: true };
    const docB = { signed: true, rule: { version: 1, id: "nc-1" } };
    expect(sha256Hex(canonicalJson(docA))).toBe(sha256Hex(canonicalJson(docB)));
  });

  it("produces a different hash if any value changes", () => {
    const original = { rule: { id: "nc-1", version: 1 } };
    const tampered = { rule: { id: "nc-1", version: 2 } };
    expect(sha256Hex(canonicalJson(original))).not.toBe(
      sha256Hex(canonicalJson(tampered))
    );
  });

  it("sha256Hex returns 64 hex chars", () => {
    const h = sha256Hex("anything");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic across calls", () => {
    const doc = { a: 1, nested: { b: [1, 2, 3] } };
    const h1 = sha256Hex(canonicalJson(doc));
    const h2 = sha256Hex(canonicalJson(doc));
    expect(h1).toBe(h2);
  });

  it("clinicalFormData changes the hash", () => {
    const base = {
      session: { id: "s1", supervisionType: "clinician" },
      clinicalFormData: { competenciesChecked: ["technical_knowledge"] },
      pdfTemplateKey: "recovery_innovations_v1",
    };
    const modified = {
      ...base,
      clinicalFormData: {
        competenciesChecked: ["technical_knowledge", "cultural_awareness"],
      },
    };
    expect(sha256Hex(canonicalJson(base))).not.toBe(
      sha256Hex(canonicalJson(modified))
    );
  });

  it("pdfTemplateKey is included in the canonical document hash", () => {
    const generic = { session: { id: "s1" }, pdfTemplateKey: "audithalo_generic" };
    const ri = { session: { id: "s1" }, pdfTemplateKey: "recovery_innovations_v1" };
    expect(sha256Hex(canonicalJson(generic))).not.toBe(
      sha256Hex(canonicalJson(ri))
    );
  });

  it("supervisionType is included in the canonical document hash", () => {
    const a = { session: { id: "s1", supervisionType: "peer" } };
    const b = { session: { id: "s1", supervisionType: "clinician" } };
    expect(sha256Hex(canonicalJson(a))).not.toBe(sha256Hex(canonicalJson(b)));
  });
});
