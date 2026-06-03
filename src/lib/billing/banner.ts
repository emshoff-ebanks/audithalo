import type { schema } from "@/lib/db";

type Org = typeof schema.organizations.$inferSelect;

export type BillingBanner = {
  kind: "trial_ending" | "past_due";
  message: string;
  ctaLabel: string;
  ctaHref: string;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TRIAL_WARNING_DAYS = 3;

/**
 * Computes a billing banner for the supervisor dashboard given the org's
 * subscription state. Pure function — no I/O.
 *
 * Returns null when nothing actionable needs surfacing (active, healthy trial,
 * no subscription, canceled). The "no subscription" case is handled by the
 * onboarding checklist; canceled is out of scope here.
 */
export function computeBillingBanner(
  org: Pick<
    Org,
    "subscriptionStatus" | "subscriptionPeriodEnd" | "subscriptionTier"
  >,
  now: Date = new Date()
): BillingBanner | null {
  if (org.subscriptionStatus === "past_due") {
    return {
      kind: "past_due",
      message:
        "Your latest payment failed. Update your payment method to keep your account active.",
      ctaLabel: "Update payment method",
      ctaHref: "/dashboard/billing",
    };
  }

  if (org.subscriptionStatus === "trialing" && org.subscriptionPeriodEnd) {
    const msUntil = org.subscriptionPeriodEnd.getTime() - now.getTime();
    const daysUntil = Math.ceil(msUntil / MS_PER_DAY);
    // Defensive lower bound: if periodEnd has already passed, the webhook
    // should have already flipped the org to active or canceled — don't show
    // a stale trial banner.
    if (daysUntil <= TRIAL_WARNING_DAYS && daysUntil >= 0) {
      const tierLabel =
        org.subscriptionTier === "practice" ? "Practice" : "Solo";
      const dateStr = org.subscriptionPeriodEnd.toISOString().slice(0, 10);
      // Math.ceil + the daysUntil >= 0 guard means daysUntil is 1, 2, or 3
      // when we get here; the "today" branch never fires in practice.
      const dayWord =
        daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;
      return {
        kind: "trial_ending",
        message: `Your free trial ends ${dayWord} (${dateStr}) — you'll be charged for the ${tierLabel} plan unless you cancel.`,
        ctaLabel: "Manage billing",
        ctaHref: "/dashboard/billing",
      };
    }
  }

  return null;
}
