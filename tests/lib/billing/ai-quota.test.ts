import { describe, it, expect } from "vitest";
import {
  aiNoteQuotaPerMonth,
  aiNoteQuotaBlockedReason,
} from "@/lib/billing/seats";

describe("aiNoteQuotaPerMonth", () => {
  it("returns 0 when no subscription", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: null,
        subscriptionTier: null,
        subscriptionPeriodEnd: null,
      })
    ).toBe(0);
  });

  it("returns 0 when subscription is canceled", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "canceled",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      })
    ).toBe(0);
  });

  it("returns 10 for trialing solo", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "trialing",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      })
    ).toBe(10);
  });

  it("returns 10 for active solo", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "active",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      })
    ).toBe(10);
  });

  it("returns 10 for past_due solo (grace period)", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "past_due",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      })
    ).toBe(10);
  });

  it("returns null (unlimited) for active practice", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "active",
        subscriptionTier: "practice",
        subscriptionPeriodEnd: null,
      })
    ).toBeNull();
  });

  it("returns null (unlimited) for trialing practice", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "trialing",
        subscriptionTier: "practice",
        subscriptionPeriodEnd: null,
      })
    ).toBeNull();
  });

  it("returns 0 when active but tier is null (defensive)", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "active",
        subscriptionTier: null,
        subscriptionPeriodEnd: null,
      })
    ).toBe(0);
  });

  it("returns 0 when past_due grace period (7d) has expired", () => {
    const expiredPeriodEnd = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000
    );
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "past_due",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: expiredPeriodEnd,
      })
    ).toBe(0);
  });

  it("still returns 10 (solo) when past_due within grace period", () => {
    const recentPeriodEnd = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    );
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "past_due",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: recentPeriodEnd,
      })
    ).toBe(10);
  });

  it("returns null (unlimited) for enterprise regardless of status", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: null,
        subscriptionTier: "enterprise",
        subscriptionPeriodEnd: null,
      })
    ).toBeNull();
  });

  it("returns null for enterprise even when status is canceled", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "canceled",
        subscriptionTier: "enterprise",
        subscriptionPeriodEnd: null,
      })
    ).toBeNull();
  });
});

describe("aiNoteQuotaBlockedReason", () => {
  it("returns null for trialing solo at 0 used", () => {
    expect(
      aiNoteQuotaBlockedReason(
        {
          subscriptionStatus: "trialing",
          subscriptionTier: "solo",
          subscriptionPeriodEnd: null,
        },
        0
      )
    ).toBeNull();
  });

  it("returns null for trialing solo at 5 used", () => {
    expect(
      aiNoteQuotaBlockedReason(
        {
          subscriptionStatus: "trialing",
          subscriptionTier: "solo",
          subscriptionPeriodEnd: null,
        },
        5
      )
    ).toBeNull();
  });

  it("returns null for trialing solo at 9 used (under cap)", () => {
    expect(
      aiNoteQuotaBlockedReason(
        {
          subscriptionStatus: "trialing",
          subscriptionTier: "solo",
          subscriptionPeriodEnd: null,
        },
        9
      )
    ).toBeNull();
  });

  it("blocks trialing solo at exactly 10 used", () => {
    const reason = aiNoteQuotaBlockedReason(
      {
        subscriptionStatus: "trialing",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      },
      10
    );
    expect(reason).not.toBeNull();
    expect(reason!.message).toMatch(/10 of 10/);
    expect(reason!.message).toMatch(/Solo plan/);
    expect(reason!.message).toMatch(/Upgrade to Practice/);
    expect(reason!.ctaLabel).toBe("Upgrade plan");
    expect(reason!.ctaHref).toBe("/dashboard/billing");
  });

  it("blocks trialing solo at 11 used (over cap)", () => {
    const reason = aiNoteQuotaBlockedReason(
      {
        subscriptionStatus: "trialing",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      },
      11
    );
    expect(reason).not.toBeNull();
    expect(reason!.message).toMatch(/11 of 10/);
  });

  it("returns null for active practice at 0 used", () => {
    expect(
      aiNoteQuotaBlockedReason(
        {
          subscriptionStatus: "active",
          subscriptionTier: "practice",
          subscriptionPeriodEnd: null,
        },
        0
      )
    ).toBeNull();
  });

  it("returns null for active practice at 100 used", () => {
    expect(
      aiNoteQuotaBlockedReason(
        {
          subscriptionStatus: "active",
          subscriptionTier: "practice",
          subscriptionPeriodEnd: null,
        },
        100
      )
    ).toBeNull();
  });

  it("returns null for active practice at 9999 used (truly unlimited)", () => {
    expect(
      aiNoteQuotaBlockedReason(
        {
          subscriptionStatus: "active",
          subscriptionTier: "practice",
          subscriptionPeriodEnd: null,
        },
        9999
      )
    ).toBeNull();
  });

  it("blocks canceled subscription with no-plan reason pointing at Pricing", () => {
    const reason = aiNoteQuotaBlockedReason(
      {
        subscriptionStatus: "canceled",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      },
      0
    );
    expect(reason).not.toBeNull();
    expect(reason!.message).toMatch(/active subscription/i);
    expect(reason!.ctaLabel).toBe("See pricing");
    expect(reason!.ctaHref).toBe("/dashboard/billing");
  });

  it("blocks org with null tier", () => {
    const reason = aiNoteQuotaBlockedReason(
      {
        subscriptionStatus: "active",
        subscriptionTier: null,
        subscriptionPeriodEnd: null,
      },
      0
    );
    expect(reason).not.toBeNull();
    expect(reason!.message).toMatch(/active subscription/i);
  });

  it("blocks org with null status with no-plan reason", () => {
    const reason = aiNoteQuotaBlockedReason(
      {
        subscriptionStatus: null,
        subscriptionTier: null,
        subscriptionPeriodEnd: null,
      },
      0
    );
    expect(reason).not.toBeNull();
    expect(reason!.message).toMatch(/active subscription/i);
  });

  it("returns the past_due reason pointing at Billing when grace expired", () => {
    const expiredPeriodEnd = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000
    );
    const reason = aiNoteQuotaBlockedReason(
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

  it("returns null for past_due solo within grace at 5 used", () => {
    const recentPeriodEnd = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    );
    expect(
      aiNoteQuotaBlockedReason(
        {
          subscriptionStatus: "past_due",
          subscriptionTier: "solo",
          subscriptionPeriodEnd: recentPeriodEnd,
        },
        5
      )
    ).toBeNull();
  });

  it("returns null for enterprise even at high used counts", () => {
    expect(
      aiNoteQuotaBlockedReason(
        {
          subscriptionStatus: null,
          subscriptionTier: "enterprise",
          subscriptionPeriodEnd: null,
        },
        9999
      )
    ).toBeNull();
  });
});
