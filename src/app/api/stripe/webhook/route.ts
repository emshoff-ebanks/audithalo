import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { requireStripe, tierFromPriceId } from "@/lib/stripe";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

/** Sync subscription state from a Stripe Subscription object onto the org row. */
async function syncSubscription(sub: Stripe.Subscription) {
  const orgId = sub.metadata?.orgId;
  if (!orgId) return;
  const firstItem = sub.items.data[0];
  const priceId = firstItem?.price?.id ?? "";
  const tier = tierFromPriceId(priceId);
  // Stripe subscription period_end is on the subscription item for newer API; fall back to item.
  const periodEnd =
    (firstItem as { current_period_end?: number } | undefined)
      ?.current_period_end ?? null;

  await db
    .update(schema.organizations)
    .set({
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      subscriptionTier: tier,
      subscriptionPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    })
    .where(eq(schema.organizations.id, orgId));
}

export async function POST(req: NextRequest) {
  const stripe = requireStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("STRIPE_WEBHOOK_SECRET not set", { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "bad signature";
    return new Response(`Webhook signature verification failed: ${message}`, {
      status: 400,
    });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "checkout.session.completed": {
      const sess = event.data.object as Stripe.Checkout.Session;
      if (typeof sess.subscription === "string") {
        const sub = await stripe.subscriptions.retrieve(sess.subscription);
        await syncSubscription(sub);
      }
      break;
    }
    default:
      // ignore other events
      break;
  }

  return new Response("ok", { status: 200 });
}
