import { describe, it, expect } from "vitest";
import {
  mergeRecentEvidence,
  type SealedEvidenceItem,
  type PendingSignatureItem,
} from "@/lib/supervisee-evidence";

const sealed: SealedEvidenceItem[] = [
  {
    sessionId: "s-sep9",
    documentHash: "c81a1234deadbeef3fd0",
    sealedAt: new Date("2026-09-09T19:22:00Z"),
    sessionDate: new Date("2026-09-09T14:00:00Z"),
  },
  {
    sessionId: "s-aug20",
    documentHash: "9f2caaaabbbb47e0",
    sealedAt: new Date("2026-08-20T13:00:00Z"),
    sessionDate: new Date("2026-08-20T13:00:00Z"),
  },
];

const pending: PendingSignatureItem[] = [
  {
    sessionId: "s-sep12",
    sessionDate: new Date("2026-09-12T15:00:00Z"),
    awaitingSelf: true,
  },
  {
    sessionId: "s-sep2",
    sessionDate: new Date("2026-09-02T15:00:00Z"),
    awaitingSelf: false,
  },
];

describe("mergeRecentEvidence", () => {
  it("merges both kinds and sorts by session date descending", () => {
    const rows = mergeRecentEvidence(sealed, pending);
    expect(rows.map((r) => r.sessionId)).toEqual([
      "s-sep12", // pending, Sep 12
      "s-sep9", // sealed, Sep 9
      "s-sep2", // pending, Sep 2
      "s-aug20", // sealed, Aug 20
    ]);
    expect(rows.map((r) => r.type)).toEqual([
      "pending",
      "sealed",
      "pending",
      "sealed",
    ]);
  });

  it("caps to the limit, keeping the newest rows", () => {
    const rows = mergeRecentEvidence(sealed, pending, 2);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.sessionId)).toEqual(["s-sep12", "s-sep9"]);
  });

  it("preserves the awaitingSelf flag on pending rows for the sign path", () => {
    const rows = mergeRecentEvidence([], pending);
    const self = rows.find((r) => r.sessionId === "s-sep12");
    expect(self).toMatchObject({ type: "pending", awaitingSelf: true });
    const other = rows.find((r) => r.sessionId === "s-sep2");
    expect(other).toMatchObject({ type: "pending", awaitingSelf: false });
  });

  it("handles empty inputs", () => {
    expect(mergeRecentEvidence([], [])).toEqual([]);
  });
});
