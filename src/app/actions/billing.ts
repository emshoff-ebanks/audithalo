"use server";

import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isManagerRole } from "@/lib/authz";
import { countBillableSeats } from "@/lib/billing/seats";
import { db, schema } from "@/lib/db";
import { PRICES, requireStripe, type PlanKey } from "@/lib/stripe";

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

  // Build line items per plan
  let lineItems: Array<{ price: string; quantity?: number }>;
  if (plan === "solo_monthly") {
    lineItems = [{ price: PRICES.solo_monthly, quantity: 1 }];
  } else if (plan === "solo_yearly") {
    lineItems = [{ price: PRICES.solo_yearly, quantity: 1 }];
  } else {
    // Practice: $49 base flat fee + $25 per supervisee per month (per-unit licensed pricing)
    const seatCount = Math.max(1, await countBillableSeats(org.id));
    lineItems = [
      { price: PRICES.practice_base, quantity: 1 },
      { price: PRICES.practice_seat, quantity: seatCount },
    ];
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
      allow_promotion_codes: true,
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
