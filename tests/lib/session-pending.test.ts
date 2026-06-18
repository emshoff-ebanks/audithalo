import { describe, it, expect } from "vitest";
import {
  isSessionPendingSignature,
  type PendingCandidate,
} from "@/lib/session-pending";

const NOW = new Date("2026-06-18T18:00:00Z");

function mk(overrides: Partial<PendingCandidate> = {}): PendingCandidate {
  return {
    kind: "supervision",
    signedAt: null,
    scheduledStatus: null,
    // 4 hours ago, 1h long — ended 3 hours before NOW.
    date: new Date("2026-06-18T14:00:00Z"),
    durationHours: 1,
    ...overrides,
  };
}

describe("isSessionPendingSignature", () => {
  it("returns true for a past-end unsigned supervision row", () => {
    expect(isSessionPendingSignature(mk(), NOW)).toBe(true);
  });

  it("returns false for practice events", () => {
    expect(isSessionPendingSignature(mk({ kind: "practice" }), NOW)).toBe(
      false
    );
  });

  it("returns false when already signed", () => {
    expect(
      isSessionPendingSignature(mk({ signedAt: new Date() }), NOW)
    ).toBe(false);
  });

  it("returns false for canceled rows", () => {
    expect(
      isSessionPendingSignature(mk({ scheduledStatus: "canceled" }), NOW)
    ).toBe(false);
  });

  it("returns false for no_show rows (the SessionLog regression)", () => {
    expect(
      isSessionPendingSignature(mk({ scheduledStatus: "no_show" }), NOW)
    ).toBe(false);
  });

  it("returns false when the meeting hasn't ended yet", () => {
    // Starts now, runs 1 hour → end is 1h in the future.
    expect(
      isSessionPendingSignature(mk({ date: NOW, durationHours: 1 }), NOW)
    ).toBe(false);
  });

  it("returns true for past-end rows still tagged scheduledStatus='scheduled'", () => {
    expect(
      isSessionPendingSignature(
        mk({ scheduledStatus: "scheduled" }),
        NOW
      )
    ).toBe(true);
  });

  it("accepts ISO string dates (component-layer payload shape)", () => {
    expect(
      isSessionPendingSignature(
        mk({ date: "2026-06-18T14:00:00Z" }),
        NOW
      )
    ).toBe(true);
  });

  it("returns false for an unparseable date string", () => {
    expect(
      isSessionPendingSignature(mk({ date: "not-a-date" }), NOW)
    ).toBe(false);
  });
});
