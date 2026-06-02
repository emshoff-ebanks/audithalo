import { describe, it, expect } from "vitest";
import {
  findSeatItem,
  seatCap,
  seatCapBlockedReason,
  shouldSyncSeats,
} from "@/lib/billing/seats";

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

describe("shouldSyncSeats", () => {
  it("returns true for practice with subscription id", () => {
    expect(
      shouldSyncSeats({
        subscriptionTier: "practice",
        subscriptionStatus: "active",
        stripeSubscriptionId: "sub_123"
      })
    ).toBe(true);
  });

  it("returns false for solo even with subscription id", () => {
    expect(
      shouldSyncSeats({
        subscriptionTier: "solo",
        subscriptionStatus: "active",
        stripeSubscriptionId: "sub_123"
      })
    ).toBe(false);
  });

  it("returns false for practice without subscription id", () => {
    expect(
      shouldSyncSeats({
        subscriptionTier: "practice",
        subscriptionStatus: "active",
        stripeSubscriptionId: null
      })
    ).toBe(false);
  });

  it("returns false for practice with canceled subscription", () => {
    expect(
      shouldSyncSeats({
        subscriptionTier: "practice",
        subscriptionStatus: "canceled",
        stripeSubscriptionId: "sub_123",
      })
    ).toBe(false);
  });

  it("returns true for practice with active subscription", () => {
    expect(
      shouldSyncSeats({
        subscriptionTier: "practice",
        subscriptionStatus: "active",
        stripeSubscriptionId: "sub_123",
      })
    ).toBe(true);
  });
});

describe("findSeatItem", () => {
  function mkSub(items: Array<{ id: string; priceId: string }>) {
    return {
      items: {
        data: items.map((i) => ({ id: i.id, price: { id: i.priceId } })),
      },
    } as unknown as import("stripe").Stripe.Subscription;
  }

  it("returns the matching item by price id", () => {
    const sub = mkSub([
      { id: "si_base", priceId: "price_base" },
      { id: "si_seat", priceId: "price_seat" },
    ]);
    const found = findSeatItem(sub, "price_seat");
    expect(found?.id).toBe("si_seat");
  });

  it("returns null when no item matches", () => {
    const sub = mkSub([{ id: "si_base", priceId: "price_base" }]);
    expect(findSeatItem(sub, "price_seat")).toBeNull();
  });

  it("returns null when subscription has no items", () => {
    const sub = mkSub([]);
    expect(findSeatItem(sub, "price_seat")).toBeNull();
  });

  it("returns the matching item when it's the first item", () => {
    const sub = mkSub([
      { id: "si_seat", priceId: "price_seat" },
      { id: "si_base", priceId: "price_base" },
    ]);
    expect(findSeatItem(sub, "price_seat")?.id).toBe("si_seat");
  });
});
