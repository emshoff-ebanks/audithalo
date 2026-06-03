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
    const msg = aiNoteQuotaBlockedReason(
      {
        subscriptionStatus: "trialing",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      },
      10
    );
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/10 of 10/);
    expect(msg).toMatch(/Solo plan/);
    expect(msg).toMatch(/Upgrade to Practice/);
  });

  it("blocks trialing solo at 11 used (over cap)", () => {
    const msg = aiNoteQuotaBlockedReason(
      {
        subscriptionStatus: "trialing",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      },
      11
    );
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/11 of 10/);
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

  it("blocks canceled subscription with no-plan message", () => {
    const msg = aiNoteQuotaBlockedReason(
      {
        subscriptionStatus: "canceled",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: null,
      },
      0
    );
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/active subscription/i);
    expect(msg).toMatch(/Billing/);
  });

  it("blocks org with null tier", () => {
    const msg = aiNoteQuotaBlockedReason(
      {
        subscriptionStatus: "active",
        subscriptionTier: null,
        subscriptionPeriodEnd: null,
      },
      0
    );
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/active subscription/i);
  });

  it("blocks org with null status with no-plan message", () => {
    const msg = aiNoteQuotaBlockedReason(
      {
        subscriptionStatus: null,
        subscriptionTier: null,
        subscriptionPeriodEnd: null,
      },
      0
    );
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/active subscription/i);
  });

  it("returns the past_due message when grace expired", () => {
    const expiredPeriodEnd = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000
    );
    const msg = aiNoteQuotaBlockedReason(
      {
        subscriptionStatus: "past_due",
        subscriptionTier: "solo",
        subscriptionPeriodEnd: expiredPeriodEnd,
      },
      0
    );
    expect(msg).toMatch(/overdue/i);
    expect(msg).toMatch(/Billing/);
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
});
