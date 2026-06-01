import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

// Pin to the SDK's bundled default API version (we don't override it).
export const stripe = key ? new Stripe(key, { typescript: true }) : null;

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to your environment and redeploy."
    );
  }
  return stripe;
}

/** Mapping of our internal tier choices to Stripe Price IDs (env-driven). */
export const PRICES = {
  solo_monthly: process.env.STRIPE_PRICE_SOLO_MONTHLY ?? "",
  solo_yearly: process.env.STRIPE_PRICE_SOLO_YEARLY ?? "",
  practice_base: process.env.STRIPE_PRICE_PRACTICE_BASE ?? "",
  practice_seat: process.env.STRIPE_PRICE_PRACTICE_SEAT ?? "",
} as const;

export type PlanKey = "solo_monthly" | "solo_yearly" | "practice";

/** Inverse lookup: given a price ID, what tier is it part of? */
export function tierFromPriceId(priceId: string): "solo" | "practice" | null {
  if (priceId === PRICES.solo_monthly || priceId === PRICES.solo_yearly) {
    return "solo";
  }
  if (priceId === PRICES.practice_base || priceId === PRICES.practice_seat) {
    return "practice";
  }
  return null;
}
