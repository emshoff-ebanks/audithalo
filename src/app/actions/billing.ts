"use server";

import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { PRICES, requireStripe, type PlanKey } from "@/lib/stripe";

const MIN_PRACTICE_SEATS = 1;
const MAX_PRACTICE_SEATS = 50;

const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";

type Result = { ok: true; url: string } | { ok: false; error: string };

/** Create or fetch the Stripe customer for the current org and return its id. */
async function getOrCreateCustomer(
  orgId: string,
  email: string,
  orgName: string
): Promise<string> {
  const stripe = requireStripe();
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, orgId),
  });
  if (org?.stripeCustomerId) return org.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    name: orgName,
    metadata: { orgId },
  });
  await db
    .update(schema.organizations)
    .set({ stripeCustomerId: customer.id })
    .where(eq(schema.organizations.id, orgId));
  return customer.id;
}

/**
 * Resolve a human-readable promotion code (e.g. "MARIA-BETA") to the
 * underlying Stripe promotion_code ID via the API. Returns null if no
 * active code matches — checkout proceeds without a discount in that case
 * (graceful degradation; never blocks a paying customer because the URL
 * carried a typo).
 */
async function resolvePromotionCodeId(code: string): Promise<string | null> {
  const stripe = requireStripe();
  try {
    const result = await stripe.promotionCodes.list({
      code: code.trim(),
      active: true,
      limit: 1,
    });
    return result.data[0]?.id ?? null;
  } catch (err) {
    console.error("[billing] promotion code lookup failed:", err);
    return null;
  }
}

export async function startCheckoutAction(formData: FormData): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const plan = formData.get("plan") as PlanKey;
  if (!["solo_monthly", "solo_yearly", "practice"].includes(plan)) {
    return { ok: false, error: "Invalid plan." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return { ok: false, error: "No organization." };
  if (!isManagerRole(membership.role)) {
    return {
      ok: false,
      error: "Only the supervisor can change billing.",
    };
  }

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, membership.orgId),
  });
  if (!org) return { ok: false, error: "Organization not found." };

  let customerId: string;
  try {
    customerId = await getOrCreateCustomer(
      org.id,
      session.user.email,
      org.name
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Stripe not configured.",
    };
  }

  // Build line items per plan. Practice pre-commits seats at checkout: the
  // supervisor picks how many supervisees they're buying for, and that
  // quantity locks in on the subscription. Adding seats later requires
  // editing the subscription in the Stripe Billing Portal.
  let lineItems: Array<{ price: string; quantity?: number }>;
  if (plan === "solo_monthly") {
    lineItems = [{ price: PRICES.solo_monthly, quantity: 1 }];
  } else if (plan === "solo_yearly") {
    lineItems = [{ price: PRICES.solo_yearly, quantity: 1 }];
  } else {
    const rawSeatCount = Number(formData.get("seatCount"));
    if (
      !Number.isFinite(rawSeatCount) ||
      rawSeatCount < MIN_PRACTICE_SEATS ||
      rawSeatCount > MAX_PRACTICE_SEATS
    ) {
      return {
        ok: false,
        error: `Pick a seat count between ${MIN_PRACTICE_SEATS} and ${MAX_PRACTICE_SEATS}.`,
      };
    }
    const seatCount = Math.floor(rawSeatCount);
    lineItems = [
      { price: PRICES.practice_base, quantity: 1 },
      { price: PRICES.practice_seat, quantity: seatCount },
    ];
  }

  // Pre-fill a promotion code if the caller passed one. Used by the
  // Founding Supervisor flow: each cohort member gets a unique code (e.g.
  // "MARIA-BETA") tied to the founding_supervisor_lifetime coupon. Hitting
  // /dashboard/billing?promo=MARIA-BETA drops them at a $0 Stripe Checkout
  // with the code already applied — no input box to fumble.
  //
  // If the code doesn't resolve (typo, expired, etc.), we fall back to
  // `allow_promotion_codes: true` so the user can still type one manually
  // rather than getting silently blocked.
  const promoCodeRaw = (formData.get("promoCode") as string | null)?.trim();
  let promoCodeId: string | null = null;
  if (promoCodeRaw) {
    promoCodeId = await resolvePromotionCodeId(promoCodeRaw);
  }

  const stripe = requireStripe();
  try {
    const checkout = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: lineItems,
      success_url: `${APP_URL}/dashboard/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/dashboard/billing?status=canceled`,
      subscription_data: {
        metadata: { orgId: org.id, plan },
        trial_period_days: 14,
      },
      // When the caller passed a resolvable promo code, lock it in via
      // `discounts` so the checkout opens with the code pre-applied
      // (Stripe doesn't allow `allow_promotion_codes` and `discounts`
      // simultaneously). Otherwise leave the manual entry box open.
      ...(promoCodeId
        ? { discounts: [{ promotion_code: promoCodeId }] }
        : { allow_promotion_codes: true }),
      // When the discount brings the total to $0 (e.g. Founding 100%-off
      // lifetime), skip the card-collection step entirely. Stripe only
      // honors this when payment_method_collection: "if_required" is set.
      payment_method_collection: "if_required",
      billing_address_collection: "auto",
    });
    if (!checkout.url) {
      return { ok: false, error: "Stripe did not return a checkout URL." };
    }
    return { ok: true, url: checkout.url };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Stripe error.",
    };
  }
}

export async function startPortalAction(): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isManagerRole(membership.role)) {
    return { ok: false, error: "Only the supervisor can manage billing." };
  }
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, membership.orgId),
  });
  if (!org?.stripeCustomerId) {
    return { ok: false, error: "No Stripe customer yet — subscribe first." };
  }
  const stripe = requireStripe();
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${APP_URL}/dashboard/billing`,
    });
    return { ok: true, url: portal.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    return { ok: false, error: message };
  }
}
