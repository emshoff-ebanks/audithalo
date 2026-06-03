import { describe, it, expect } from "vitest";
import { computeBillingBanner } from "@/lib/billing/banner";

const NOW = new Date("2026-06-02T12:00:00Z");
const inDays = (n: number) =>
  new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("computeBillingBanner", () => {
  it("returns null for no subscription", () => {
    expect(
      computeBillingBanner(
        {
          subscriptionStatus: null,
          subscriptionPeriodEnd: null,
          subscriptionTier: null,
        },
        NOW
      )
    ).toBeNull();
  });

  it("returns null for active subscription", () => {
    expect(
      computeBillingBanner(
        {
          subscriptionStatus: "active",
          subscriptionPeriodEnd: inDays(20),
          subscriptionTier: "solo",
        },
        NOW
      )
    ).toBeNull();
  });

  it("returns null for trialing more than 3 days out", () => {
    expect(
      computeBillingBanner(
        {
          subscriptionStatus: "trialing",
          subscriptionPeriodEnd: inDays(10),
          subscriptionTier: "solo",
        },
        NOW
      )
    ).toBeNull();
  });

  it("returns trial_ending banner exactly 3 days out", () => {
    const b = computeBillingBanner(
      {
        subscriptionStatus: "trialing",
        subscriptionPeriodEnd: inDays(3),
        subscriptionTier: "solo",
      },
      NOW
    );
    expect(b?.kind).toBe("trial_ending");
    expect(b?.message).toMatch(/in 3 days/);
    expect(b?.message).toMatch(/Solo plan/);
    expect(b?.ctaHref).toBe("/dashboard/billing");
    expect(b?.ctaLabel).toBe("Manage billing");
  });

  it("returns 'tomorrow' wording 1 day out with Practice tier label", () => {
    const b = computeBillingBanner(
      {
        subscriptionStatus: "trialing",
        subscriptionPeriodEnd: inDays(1),
        subscriptionTier: "practice",
      },
      NOW
    );
    expect(b?.kind).toBe("trial_ending");
    expect(b?.message).toMatch(/tomorrow/);
    expect(b?.message).toMatch(/Practice plan/);
  });

  it("returns null for past trial periodEnd (defensive lower bound)", () => {
    expect(
      computeBillingBanner(
        {
          subscriptionStatus: "trialing",
          subscriptionPeriodEnd: inDays(-1),
          subscriptionTier: "solo",
        },
        NOW
      )
    ).toBeNull();
  });

  it("returns past_due banner when periodEnd is in the future (within grace)", () => {
    const b = computeBillingBanner(
      {
        subscriptionStatus: "past_due",
        subscriptionPeriodEnd: inDays(15),
        subscriptionTier: "solo",
      },
      NOW
    );
    expect(b?.kind).toBe("past_due");
    expect(b?.message).toMatch(/payment failed/i);
    expect(b?.ctaHref).toBe("/dashboard/billing");
    expect(b?.ctaLabel).toBe("Update payment method");
  });

  it("returns past_due banner when periodEnd was 3 days ago (within 7-day grace)", () => {
    const b = computeBillingBanner(
      {
        subscriptionStatus: "past_due",
        subscriptionPeriodEnd: inDays(-3),
        subscriptionTier: "solo",
      },
      NOW
    );
    expect(b?.kind).toBe("past_due");
    expect(b?.message).toMatch(/payment failed/i);
  });

  it("returns past_due_expired banner when periodEnd was 10 days ago (past grace)", () => {
    const b = computeBillingBanner(
      {
        subscriptionStatus: "past_due",
        subscriptionPeriodEnd: inDays(-10),
        subscriptionTier: "solo",
      },
      NOW
    );
    expect(b?.kind).toBe("past_due_expired");
    expect(b?.message).toMatch(/restricted/i);
    expect(b?.ctaHref).toBe("/dashboard/billing");
    expect(b?.ctaLabel).toBe("Update payment method");
  });

  it("returns past_due (not expired) when periodEnd is null (defensive)", () => {
    const b = computeBillingBanner(
      {
        subscriptionStatus: "past_due",
        subscriptionPeriodEnd: null,
        subscriptionTier: "solo",
      },
      NOW
    );
    expect(b?.kind).toBe("past_due");
  });

  it("returns null for canceled subscription", () => {
    expect(
      computeBillingBanner(
        {
          subscriptionStatus: "canceled",
          subscriptionPeriodEnd: inDays(-5),
          subscriptionTier: "solo",
        },
        NOW
      )
    ).toBeNull();
  });
});
