import type { schema } from "@/lib/db";

type Org = typeof schema.organizations.$inferSelect;

const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due"]);

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
