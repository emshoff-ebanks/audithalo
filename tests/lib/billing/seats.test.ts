import { describe, it, expect } from "vitest";
import { seatCap, seatCapBlockedReason } from "@/lib/billing/seats";

describe("seatCap", () => {
  it("returns 0 when no subscription", () => {
    expect(seatCap({ subscriptionStatus: null, subscriptionTier: null })).toBe(0);
  });

  it("returns 0 when subscription is canceled", () => {
    expect(seatCap({ subscriptionStatus: "canceled", subscriptionTier: "solo" })).toBe(0);
  });

  it("returns 3 for trialing solo", () => {
    expect(seatCap({ subscriptionStatus: "trialing", subscriptionTier: "solo" })).toBe(3);
  });

  it("returns 3 for active solo", () => {
    expect(seatCap({ subscriptionStatus: "active", subscriptionTier: "solo" })).toBe(3);
  });

  it("returns 3 for past_due solo (grace period)", () => {
    expect(seatCap({ subscriptionStatus: "past_due", subscriptionTier: "solo" })).toBe(3);
  });

  it("returns null (unlimited) for active practice", () => {
    expect(seatCap({ subscriptionStatus: "active", subscriptionTier: "practice" })).toBeNull();
  });

  it("returns 0 when active but tier is null (defensive)", () => {
    expect(seatCap({ subscriptionStatus: "active", subscriptionTier: null })).toBe(0);
  });
});

describe("seatCapBlockedReason", () => {
  it("returns null when within cap on solo", () => {
    expect(
      seatCapBlockedReason(
        { subscriptionStatus: "trialing", subscriptionTier: "solo" },
        2
      )
    ).toBeNull();
  });

  it("returns null for practice regardless of used count", () => {
    expect(
      seatCapBlockedReason(
        { subscriptionStatus: "active", subscriptionTier: "practice" },
        9999
      )
    ).toBeNull();
  });

  it("returns the no-plan message when no subscription", () => {
    const msg = seatCapBlockedReason(
      { subscriptionStatus: null, subscriptionTier: null },
      0
    );
    expect(msg).toMatch(/active subscription/i);
    expect(msg).toMatch(/Billing/);
  });

  it("returns the upgrade message when solo is at cap", () => {
    const msg = seatCapBlockedReason(
      { subscriptionStatus: "active", subscriptionTier: "solo" },
      3
    );
    expect(msg).toMatch(/Solo plan covers 3 supervisees/);
    expect(msg).toMatch(/Upgrade to Practice/);
  });

  it("blocks one over the cap (4 with solo)", () => {
    const msg = seatCapBlockedReason(
      { subscriptionStatus: "active", subscriptionTier: "solo" },
      4
    );
    expect(msg).not.toBeNull();
  });
});
