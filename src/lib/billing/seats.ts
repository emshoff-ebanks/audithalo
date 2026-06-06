import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db, schema } from "@/lib/db";

type Org = typeof schema.organizations.$inferSelect;

export const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due"]);

const PAST_DUE_GRACE_PERIOD_DAYS = 7;
const PAST_DUE_GRACE_PERIOD_MS = PAST_DUE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Pure: an org in past_due status is still "active" for the first 7 days after
 * their billing period ended (Stripe is retrying payment in the background).
 * After that grace period expires, treat them as restricted.
 *
 * Stripe behavior: when a payment fails, status flips to `past_due` but
 * `subscriptionPeriodEnd` does NOT advance until payment succeeds — so
 * `subscriptionPeriodEnd` is effectively the "last good through" date.
 */
export function isPastDueGracePeriodExpired(
  org: Pick<Org, "subscriptionStatus" | "subscriptionPeriodEnd">,
  now: Date = new Date()
): boolean {
  if (org.subscriptionStatus !== "past_due") return false;
  if (!org.subscriptionPeriodEnd) return false; // defensive — shouldn't happen for past_due orgs
  return (
    now.getTime() > org.subscriptionPeriodEnd.getTime() + PAST_DUE_GRACE_PERIOD_MS
  );
}

/** Seat cap for this org's current plan. null = unlimited. 0 = no plan, can't invite. */
export function seatCap(
  org: Pick<
    Org,
    | "subscriptionStatus"
    | "subscriptionTier"
    | "subscriptionPeriodEnd"
    | "seatCount"
  >,
  now: Date = new Date()
): number | null {
  if (!org.subscriptionStatus || !ACTIVE_STATUSES.has(org.subscriptionStatus)) {
    return 0;
  }
  if (isPastDueGracePeriodExpired(org, now)) {
    return 0;
  }
  if (org.subscriptionTier === "solo") return 3;
  if (org.subscriptionTier === "practice") {
    // Pre-commit seats: seat_count is the purchased ceiling, set from the
    // Stripe checkout line-item quantity. Legacy practice orgs (seat_count
    // null) keep the prior uncapped behavior until they update their plan.
    return org.seatCount ?? null;
  }
  return 0;
}

/** Structured block reason — message + a single follow-up CTA. null = allowed. */
export type BlockedReason = {
  message: string;
  ctaLabel: string;
  ctaHref: string;
} | null;

/** Returns a structured reason the org cannot invite another supervisee, or null if allowed. */
export function seatCapBlockedReason(
  org: Pick<
    Org,
    | "subscriptionStatus"
    | "subscriptionTier"
    | "subscriptionPeriodEnd"
    | "seatCount"
  >,
  used: number,
  now: Date = new Date()
): BlockedReason {
  const cap = seatCap(org, now);
  if (cap === null) return null;
  if (cap === 0) {
    if (isPastDueGracePeriodExpired(org, now)) {
      return {
        message:
          "Your payment is overdue. Update your payment method to restore access.",
        ctaLabel: "Update billing",
        ctaHref: "/dashboard/billing",
      };
    }
    // No subscription at all — point at public Pricing so the supervisor sees
    // tiers before committing to the in-app billing flow.
    return {
      message: "You need an active subscription to invite supervisees.",
      ctaLabel: "See pricing",
      ctaHref: "/dashboard/billing",
    };
  }
  if (used >= cap) {
    // Solo tier always upsells to Practice. Practice tier (cap is the
    // purchased seat_count) asks the supervisor to bump their quantity.
    if (org.subscriptionTier === "practice") {
      return {
        message: `You've used all ${cap} seats on your Practice plan. Add more in billing.`,
        ctaLabel: "Manage billing",
        ctaHref: "/dashboard/billing",
      };
    }
    return {
      message: `Your Solo plan covers ${cap} supervisees. Upgrade to Practice for more seats.`,
      ctaLabel: "Upgrade plan",
      ctaHref: "/dashboard/billing",
    };
  }
  return null;
}

/** AI note quota for an org's current plan. null = unlimited. 0 = no AI access. */
export function aiNoteQuotaPerMonth(
  org: Pick<
    Org,
    | "subscriptionStatus"
    | "subscriptionTier"
    | "subscriptionPeriodEnd"
  >,
  now: Date = new Date()
): number | null {
  if (!org.subscriptionStatus || !ACTIVE_STATUSES.has(org.subscriptionStatus)) {
    return 0;
  }
  if (isPastDueGracePeriodExpired(org, now)) {
    return 0;
  }
  if (org.subscriptionTier === "solo") return 10;
  if (org.subscriptionTier === "practice") return null;
  return 0;
}

/** Structured reason AI quota would be exceeded. null = allowed. */
export function aiNoteQuotaBlockedReason(
  org: Pick<
    Org,
    "subscriptionStatus" | "subscriptionTier" | "subscriptionPeriodEnd"
  >,
  usedThisMonth: number,
  now: Date = new Date()
): BlockedReason {
  const quota = aiNoteQuotaPerMonth(org, now);
  if (quota === null) return null; // unlimited
  if (quota === 0) {
    if (isPastDueGracePeriodExpired(org, now)) {
      return {
        message:
          "Your payment is overdue. Update your payment method to restore AI session notes.",
        ctaLabel: "Update billing",
        ctaHref: "/dashboard/billing",
      };
    }
    return {
      message: "AI session notes require an active subscription.",
      ctaLabel: "See pricing",
      ctaHref: "/dashboard/billing",
    };
  }
  if (usedThisMonth >= quota) {
    return {
      message: `You've used ${usedThisMonth} of ${quota} AI session notes this month on the Solo plan. Upgrade to Practice for unlimited transcripts.`,
      ctaLabel: "Upgrade plan",
      ctaHref: "/dashboard/billing",
    };
  }
  return null;
}

/** Pure: should this org sync seat quantity to Stripe? */
export function shouldSyncSeats(
  org: Pick<Org, "subscriptionTier" | "subscriptionStatus" | "stripeSubscriptionId">
): boolean {
  return (
    org.subscriptionTier === "practice" &&
    !!org.stripeSubscriptionId &&
    !!org.subscriptionStatus &&
    ACTIVE_STATUSES.has(org.subscriptionStatus)
  );
}

/** Pure: find the seat item in a Stripe subscription, or null if not present. */
export function findSeatItem(
  sub: Stripe.Subscription,
  seatPriceId: string
): Stripe.SubscriptionItem | null {
  return sub.items.data.find((i) => i.price.id === seatPriceId) ?? null;
}

/**
 * Count supervisee MEMBERSHIPS (not open invites) — these are who Stripe bills for.
 * Note: the seat-CAP check in src/app/actions/invitations.ts counts members + open
 * invites (preventing oversubscribing). Billing only counts members (you pay for
 * who's actually using the seat, not pending invites).
 */
export async function countBillableSeats(orgId: string): Promise<number> {
  const members = await db.query.orgMemberships.findMany({
    where: and(
      eq(schema.orgMemberships.orgId, orgId),
      eq(schema.orgMemberships.role, "supervisee")
    ),
  });
  return members.length;
}

