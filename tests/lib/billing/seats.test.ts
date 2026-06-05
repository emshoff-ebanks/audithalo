import { describe, it, expect } from "vitest";
import {
  findSeatItem,
  isPastDueGracePeriodExpired,
  seatCap,
  seatCapBlockedReason,
  shouldSyncSeats,
} from "@/lib/billing/seats";

describe("seatCap", () => {
  it("returns 0 when no subscription", () => {
    expect(
      seatCap({
        subscriptionStatus: null,
        subscriptionTier: null,
        subscriptionPeriodEnd: null,
      })
    ).toBe(0);
  });

  it("returns 0 when subscription is canceled", () => {
    expect(
      seatCap({
        subscriptionStatus: "canceled",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      })
    ).toBe(0);
  });

  it("returns 3 for trialing solo", () => {
    expect(
      seatCap({
        subscriptionStatus: "trialing",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      })
    ).toBe(3);
  });

  it("returns 3 for active solo", () => {
    expect(
      seatCap({
        subscriptionStatus: "active",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      })
    ).toBe(3);
  });

  it("returns 3 for past_due solo (grace period)", () => {
    expect(
      seatCap({
        subscriptionStatus: "past_due",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      })
    ).toBe(3);
  });

  it("returns null (unlimited) for active practice", () => {
    expect(
      seatCap({
        subscriptionStatus: "active",
        subscriptionTier: "practice",
        subscriptionPeriodEnd: null,
      })
    ).toBeNull();
  });

  it("returns 0 when active but tier is null (defensive)", () => {
    expect(
      seatCap({
        subscriptionStatus: "active",
        subscriptionTier: null,
        subscriptionPeriodEnd: null,
      })
    ).toBe(0);
  });

  it("returns 0 when past_due grace period (7d) has expired", () => {
    const expiredPeriodEnd = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000
    ); // 10 days ago
    expect(
      seatCap({
        subscriptionStatus: "past_due",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: expiredPeriodEnd,
      })
    ).toBe(0);
  });

  it("still returns 3 (solo) when past_due within grace period", () => {
    const recentPeriodEnd = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    ); // 3 days ago, within 7-day grace
    expect(
      seatCap({
        subscriptionStatus: "past_due",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: recentPeriodEnd,
      })
    ).toBe(3);
  });

  it("still returns null (practice unlimited) when past_due within grace period", () => {
    const recentPeriodEnd = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    );
    expect(
      seatCap({
        subscriptionStatus: "past_due",
        subscriptionTier: "practice",
        subscriptionPeriodEnd: recentPeriodEnd,
      })
    ).toBeNull();
  });

  it("returns 0 for past_due practice when grace expired", () => {
    const expiredPeriodEnd = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000
    );
    expect(
      seatCap({
        subscriptionStatus: "past_due",
        subscriptionTier: "practice",
        subscriptionPeriodEnd: expiredPeriodEnd,
      })
    ).toBe(0);
  });
});

describe("isPastDueGracePeriodExpired", () => {
  it("returns false when not past_due", () => {
    expect(
      isPastDueGracePeriodExpired({
        subscriptionStatus: "active",
        subscriptionPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      })
    ).toBe(false);
  });

  it("returns false when past_due but periodEnd is null (defensive)", () => {
    expect(
      isPastDueGracePeriodExpired({
        subscriptionStatus: "past_due",
        subscriptionPeriodEnd: null,
      })
    ).toBe(false);
  });

  it("returns false when past_due within grace period (3 days ago)", () => {
    expect(
      isPastDueGracePeriodExpired({
        subscriptionStatus: "past_due",
        subscriptionPeriodEnd: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      })
    ).toBe(false);
  });

  it("returns true when past_due beyond grace period (10 days ago)", () => {
    expect(
      isPastDueGracePeriodExpired({
        subscriptionStatus: "past_due",
        subscriptionPeriodEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      })
    ).toBe(true);
  });

  it("respects the now argument", () => {
    const periodEnd = new Date("2026-01-01T00:00:00Z");
    // 6 days after periodEnd — within grace
    expect(
      isPastDueGracePeriodExpired(
        {
          subscriptionStatus: "past_due",
          subscriptionPeriodEnd: periodEnd,
        },
        new Date("2026-01-07T00:00:00Z")
      )
    ).toBe(false);
    // 8 days after periodEnd — past grace
    expect(
      isPastDueGracePeriodExpired(
        {
          subscriptionStatus: "past_due",
          subscriptionPeriodEnd: periodEnd,
        },
        new Date("2026-01-09T00:00:00Z")
      )
    ).toBe(true);
  });
});

describe("seatCapBlockedReason", () => {
  it("returns null when within cap on solo", () => {
    expect(
      seatCapBlockedReason(
        {
          subscriptionStatus: "trialing",
          subscriptionTier: "solo",
          subscriptionPeriodEnd: null,
        },
        2
      )
    ).toBeNull();
  });

  it("returns null for practice regardless of used count", () => {
    expect(
      seatCapBlockedReason(
        {
          subscriptionStatus: "active",
          subscriptionTier: "practice",
          subscriptionPeriodEnd: null,
        },
        9999
      )
    ).toBeNull();
  });

  it("returns a no-plan reason pointing at Pricing when no subscription", () => {
    const reason = seatCapBlockedReason(
      {
        subscriptionStatus: null,
        subscriptionTier: null,
        subscriptionPeriodEnd: null,
      },
      0
    );
    expect(reason).not.toBeNull();
    expect(reason!.message).toMatch(/active subscription/i);
    expect(reason!.ctaLabel).toBe("See pricing");
    expect(reason!.ctaHref).toBe("/pricing");
  });

  it("returns the upgrade reason when solo is at cap", () => {
    const reason = seatCapBlockedReason(
      {
        subscriptionStatus: "active",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      },
      3
    );
    expect(reason).not.toBeNull();
    expect(reason!.message).toMatch(/Solo plan covers 3 supervisees/);
    expect(reason!.message).toMatch(/Upgrade to Practice/);
    expect(reason!.ctaLabel).toBe("Upgrade plan");
    expect(reason!.ctaHref).toBe("/dashboard/billing");
  });

  it("blocks one over the cap (4 with solo)", () => {
    const reason = seatCapBlockedReason(
      {
        subscriptionStatus: "active",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      },
      4
    );
    expect(reason).not.toBeNull();
  });

  it("returns the past_due reason pointing at Billing when grace expired", () => {
    const expiredPeriodEnd = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000
    );
    const reason = seatCapBlockedReason(
      {
        subscriptionStatus: "past_due",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: expiredPeriodEnd,
      },
      0
    );
    expect(reason).not.toBeNull();
    expect(reason!.message).toMatch(/overdue/i);
    expect(reason!.ctaLabel).toBe("Update billing");
    expect(reason!.ctaHref).toBe("/dashboard/billing");
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
