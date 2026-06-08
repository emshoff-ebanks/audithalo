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
        seatCount: null,
      })
    ).toBe(0);
  });

  it("returns 0 when subscription is canceled", () => {
    expect(
      seatCap({
        subscriptionStatus: "canceled",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
        seatCount: null,
      })
    ).toBe(0);
  });

  it("returns 3 for trialing solo", () => {
    expect(
      seatCap({
        subscriptionStatus: "trialing",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
        seatCount: null,
      })
    ).toBe(3);
  });

  it("returns 3 for active solo", () => {
    expect(
      seatCap({
        subscriptionStatus: "active",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
        seatCount: null,
      })
    ).toBe(3);
  });

  it("returns 3 for past_due solo (grace period)", () => {
    expect(
      seatCap({
        subscriptionStatus: "past_due",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
        seatCount: null,
      })
    ).toBe(3);
  });

  it("returns null (unlimited) for legacy practice with no seatCount", () => {
    expect(
      seatCap({
        subscriptionStatus: "active",
        subscriptionTier: "practice",
        subscriptionPeriodEnd: null,
        seatCount: null,
      })
    ).toBeNull();
  });

  it("returns the purchased seatCount for active practice", () => {
    expect(
      seatCap({
        subscriptionStatus: "active",
        subscriptionTier: "practice",
        subscriptionPeriodEnd: null,
        seatCount: 5,
      })
    ).toBe(5);
  });

  it("returns 0 when active but tier is null (defensive)", () => {
    expect(
      seatCap({
        subscriptionStatus: "active",
        subscriptionTier: null,
        subscriptionPeriodEnd: null,
        seatCount: null,
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
        seatCount: null,
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
        seatCount: null,
      })
    ).toBe(3);
  });

  it("returns the seatCount for past_due practice within grace period", () => {
    const recentPeriodEnd = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    );
    expect(
      seatCap({
        subscriptionStatus: "past_due",
        subscriptionTier: "practice",
        subscriptionPeriodEnd: recentPeriodEnd,
        seatCount: 10,
      })
    ).toBe(10);
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
        seatCount: 10,
      })
    ).toBe(0);
  });

  it("returns null (unlimited) for enterprise — contract-managed, no Stripe", () => {
    expect(
      seatCap({
        subscriptionStatus: null,
        subscriptionTier: "enterprise",
        subscriptionPeriodEnd: null,
        seatCount: null,
      })
    ).toBeNull();
  });

  it("returns null for enterprise even with canceled subscription status", () => {
    // Org that was on Practice (canceled their Stripe sub) but then signed
    // an Enterprise contract still gets unlimited seats from the Enterprise tier.
    expect(
      seatCap({
        subscriptionStatus: "canceled",
        subscriptionTier: "enterprise",
        subscriptionPeriodEnd: null,
        seatCount: null,
      })
    ).toBeNull();
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

describe("seatCapBlockedReason — Enterprise bypass", () => {
  it("returns null for enterprise even at extreme used counts", () => {
    expect(
      seatCapBlockedReason(
        {
          subscriptionStatus: null,
          subscriptionTier: "enterprise",
          subscriptionPeriodEnd: null,
          seatCount: null,
        },
        9999
      )
    ).toBeNull();
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
          seatCount: null,
        },
        2
      )
    ).toBeNull();
  });

  it("returns null for legacy practice (no seatCount) regardless of used count", () => {
    expect(
      seatCapBlockedReason(
        {
          subscriptionStatus: "active",
          subscriptionTier: "practice",
          subscriptionPeriodEnd: null,
          seatCount: null,
        },
        9999
      )
    ).toBeNull();
  });

  it("blocks practice when used count equals purchased seatCount", () => {
    const reason = seatCapBlockedReason(
      {
        subscriptionStatus: "active",
        subscriptionTier: "practice",
        subscriptionPeriodEnd: null,
        seatCount: 5,
      },
      5
    );
    expect(reason).not.toBeNull();
    expect(reason!.message).toMatch(/used all 5 seats/i);
    expect(reason!.ctaLabel).toBe("Manage billing");
    expect(reason!.ctaHref).toBe("/dashboard/billing");
  });

  it("allows practice when used count is below purchased seatCount", () => {
    expect(
      seatCapBlockedReason(
        {
          subscriptionStatus: "active",
          subscriptionTier: "practice",
          subscriptionPeriodEnd: null,
          seatCount: 5,
        },
        4
      )
    ).toBeNull();
  });

  it("returns a no-plan reason pointing at Pricing when no subscription", () => {
    const reason = seatCapBlockedReason(
      {
        subscriptionStatus: null,
        subscriptionTier: null,
        subscriptionPeriodEnd: null,
        seatCount: null,
      },
      0
    );
    expect(reason).not.toBeNull();
    expect(reason!.message).toMatch(/active subscription/i);
    expect(reason!.ctaLabel).toBe("See pricing");
    expect(reason!.ctaHref).toBe("/dashboard/billing");
  });

  it("returns the upgrade reason when solo is at cap", () => {
    const reason = seatCapBlockedReason(
      {
        subscriptionStatus: "active",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
        seatCount: null,
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
        seatCount: null,
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
        seatCount: null,
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
