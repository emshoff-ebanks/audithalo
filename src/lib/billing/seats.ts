import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db, schema } from "@/lib/db";
import { PRICES, stripe } from "@/lib/stripe";

type Org = typeof schema.organizations.$inferSelect;

export const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due"]);

/** Seat cap for this org's current plan. null = unlimited. 0 = no plan, can't invite. */
export function seatCap(
  org: Pick<Org, "subscriptionStatus" | "subscriptionTier">
): number | null {
  if (!org.subscriptionStatus || !ACTIVE_STATUSES.has(org.subscriptionStatus)) {
    return 0;
  }
  if (org.subscriptionTier === "solo") return 3;
  if (org.subscriptionTier === "practice") return null;
  return 0;
}

/** Returns a user-facing block message if the org cannot invite another supervisee, or null if allowed. */
export function seatCapBlockedReason(
  org: Pick<Org, "subscriptionStatus" | "subscriptionTier">,
  used: number
): string | null {
  const cap = seatCap(org);
  if (cap === null) return null;
  if (cap === 0) {
    return "You need an active subscription to invite supervisees. Visit Billing to start your 14-day trial.";
  }
  if (used >= cap) {
    return `Your Solo plan covers ${cap} supervisees. Upgrade to Practice for unlimited seats — visit Billing.`;
  }
  return null;
}

/** AI note quota for an org's current plan. null = unlimited. 0 = no AI access. */
export function aiNoteQuotaPerMonth(
  org: Pick<Org, "subscriptionStatus" | "subscriptionTier">
): number | null {
  if (!org.subscriptionStatus || !ACTIVE_STATUSES.has(org.subscriptionStatus)) {
    return 0;
  }
  if (org.subscriptionTier === "solo") return 10;
  if (org.subscriptionTier === "practice") return null;
  return 0;
}

/** User-facing message when AI quota would be exceeded. null = allowed. */
export function aiNoteQuotaBlockedReason(
  org: Pick<Org, "subscriptionStatus" | "subscriptionTier">,
  usedThisMonth: number
): string | null {
  const quota = aiNoteQuotaPerMonth(org);
  if (quota === null) return null; // unlimited
  if (quota === 0) {
    return "AI session notes require an active subscription. Visit Billing to start your trial.";
  }
  if (usedThisMonth >= quota) {
    return `You've used ${usedThisMonth} of ${quota} AI session notes this month on the Solo plan. Upgrade to Practice for unlimited transcripts.`;
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

/**
 * If this org has a Practice subscription, update the seat-item quantity to match
 * the current member count. No-op for Solo, missing-subscription, or non-Practice orgs.
 * Safe to call from any path that adds or could add a supervisee.
 *
 * TODO: also call from a future "remove supervisee" action so seat count goes down.
 */
export async function syncPracticeSeatQuantity(orgId: string): Promise<void> {
  if (!stripe) return; // STRIPE_SECRET_KEY not set — local dev or misconfig
  if (!PRICES.practice_seat) return; // practice not configured

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, orgId),
  });
  if (!org || !shouldSyncSeats(org)) return;

  const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId!);
  const seatItem = findSeatItem(sub, PRICES.practice_seat);
  if (!seatItem) {
    console.error(
      `[billing] sub ${sub.id} for org ${orgId} has no item matching seat price ${PRICES.practice_seat}`
    );
    return;
  }

  const targetQuantity = Math.max(1, await countBillableSeats(orgId));
  if (seatItem.quantity === targetQuantity) return; // already in sync

  await stripe.subscriptions.update(sub.id, {
    items: [{ id: seatItem.id, quantity: targetQuantity }],
    proration_behavior: "create_prorations",
  });
}
