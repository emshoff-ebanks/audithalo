import { describe, it, expect } from "vitest";
import {
  aiNoteQuotaPerMonth,
  aiNoteQuotaBlockedReason,
} from "@/lib/billing/seats";

describe("aiNoteQuotaPerMonth", () => {
  it("returns 0 when no subscription", () => {
    expect(
      aiNoteQuotaPerMonth({ subscriptionStatus: null, subscriptionTier: null })
    ).toBe(0);
  });

  it("returns 0 when subscription is canceled", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "canceled",
        subscriptionTier: "solo",
      })
    ).toBe(0);
  });

  it("returns 10 for trialing solo", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "trialing",
        subscriptionTier: "solo",
      })
    ).toBe(10);
  });

  it("returns 10 for active solo", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "active",
        subscriptionTier: "solo",
      })
    ).toBe(10);
  });

  it("returns 10 for past_due solo (grace period)", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "past_due",
        subscriptionTier: "solo",
      })
    ).toBe(10);
  });

  it("returns null (unlimited) for active practice", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "active",
        subscriptionTier: "practice",
      })
    ).toBeNull();
  });

  it("returns null (unlimited) for trialing practice", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "trialing",
        subscriptionTier: "practice",
      })
    ).toBeNull();
  });

  it("returns 0 when active but tier is null (defensive)", () => {
    expect(
      aiNoteQuotaPerMonth({
        subscriptionStatus: "active",
        subscriptionTier: null,
      })
    ).toBe(0);
  });
});

describe("aiNoteQuotaBlockedReason", () => {
  it("returns null for trialing solo at 0 used", () => {
    expect(
      aiNoteQuotaBlockedReason(
        { subscriptionStatus: "trialing", subscriptionTier: "solo" },
        0
      )
    ).toBeNull();
  });

  it("returns null for trialing solo at 5 used", () => {
    expect(
      aiNoteQuotaBlockedReason(
        { subscriptionStatus: "trialing", subscriptionTier: "solo" },
        5
      )
    ).toBeNull();
  });

  it("returns null for trialing solo at 9 used (under cap)", () => {
    expect(
      aiNoteQuotaBlockedReason(
        { subscriptionStatus: "trialing", subscriptionTier: "solo" },
        9
      )
    ).toBeNull();
  });

  it("blocks trialing solo at exactly 10 used", () => {
    const msg = aiNoteQuotaBlockedReason(
      { subscriptionStatus: "trialing", subscriptionTier: "solo" },
      10
    );
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/10 of 10/);
    expect(msg).toMatch(/Solo plan/);
    expect(msg).toMatch(/Upgrade to Practice/);
  });

  it("blocks trialing solo at 11 used (over cap)", () => {
    const msg = aiNoteQuotaBlockedReason(
      { subscriptionStatus: "trialing", subscriptionTier: "solo" },
      11
    );
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/11 of 10/);
  });

  it("returns null for active practice at 0 used", () => {
    expect(
      aiNoteQuotaBlockedReason(
        { subscriptionStatus: "active", subscriptionTier: "practice" },
        0
      )
    ).toBeNull();
  });

  it("returns null for active practice at 100 used", () => {
    expect(
      aiNoteQuotaBlockedReason(
        { subscriptionStatus: "active", subscriptionTier: "practice" },
        100
      )
    ).toBeNull();
  });

  it("returns null for active practice at 9999 used (truly unlimited)", () => {
    expect(
      aiNoteQuotaBlockedReason(
        { subscriptionStatus: "active", subscriptionTier: "practice" },
        9999
      )
    ).toBeNull();
  });

  it("blocks canceled subscription with no-plan message", () => {
    const msg = aiNoteQuotaBlockedReason(
      { subscriptionStatus: "canceled", subscriptionTier: "solo" },
      0
    );
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/active subscription/i);
    expect(msg).toMatch(/Billing/);
  });

  it("blocks org with null tier", () => {
    const msg = aiNoteQuotaBlockedReason(
      { subscriptionStatus: "active", subscriptionTier: null },
      0
    );
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/active subscription/i);
  });

  it("blocks org with null status with no-plan message", () => {
    const msg = aiNoteQuotaBlockedReason(
      { subscriptionStatus: null, subscriptionTier: null },
      0
    );
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/active subscription/i);
  });
});
