import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { PRICES, requireStripe, tierFromPriceId } from "@/lib/stripe";
import { db, schema } from "@/lib/db";
import { capture } from "@/lib/observability/posthog-server";

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

  // For Practice tier, the seat-line-item quantity is the source of truth for
  // how many supervisees the org has purchased. Null for Solo / other tiers.
  let seatCount: number | null = null;
  if (tier === "practice" && PRICES.practice_seat) {
    const seatItem = sub.items.data.find(
      (i) => i.price.id === PRICES.practice_seat
    );
    if (seatItem && typeof seatItem.quantity === "number") {
      seatCount = seatItem.quantity;
    }
  }

  // Detect the trial → paid transition before we overwrite the row, so we
  // can fire the `trial_converted` event with the prior status as context.
  const prior = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, orgId),
    columns: { createdById: true, subscriptionStatus: true },
  });

  await db
    .update(schema.organizations)
    .set({
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      subscriptionTier: tier,
      subscriptionPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      seatCount,
    })
    .where(eq(schema.organizations.id, orgId));

  // Fire `trial_converted` exactly on the trialing → active transition.
  // Other status changes (active → past_due, etc.) don't qualify.
  if (
    prior?.subscriptionStatus === "trialing" &&
    sub.status === "active" &&
    prior.createdById
  ) {
    capture("trial_converted", prior.createdById, {
      orgId,
      tier: tier ?? null,
      seatCount,
    });
  }
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

  // Idempotency: skip if we've already processed this event ID.
  // Stripe retries on receiver timeout — without this, duplicate deliveries
  // could double-process side effects.
  try {
    await db.insert(schema.processedStripeEvents).values({
      eventId: event.id,
      eventType: event.type,
    });
  } catch (err) {
    // PK violation = we already processed this event. Return 200 so Stripe stops retrying.
    // neon-http surfaces Postgres unique-violation (SQLSTATE 23505) as a generic
    // Error whose message contains "duplicate" — substring check is the most
    // portable signal we have.
    if (err instanceof Error && err.message.includes("duplicate")) {
      return new Response("ok (duplicate)", { status: 200 });
    }
    // Unknown DB error: log + bubble up so Stripe retries
    console.error("[stripe-webhook] dedup insert failed:", err);
    return new Response("dedup check failed", { status: 500 });
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

        // Fire `supervisor_trial_start` once per new subscription. The org
        // owner (createdById) is the supervisor who clicked Subscribe.
        const orgId = sub.metadata?.orgId;
        if (orgId) {
          const org = await db.query.organizations.findFirst({
            where: eq(schema.organizations.id, orgId),
            columns: { createdById: true, subscriptionTier: true },
          });
          if (org?.createdById) {
            capture("supervisor_trial_start", org.createdById, {
              orgId,
              tier: org.subscriptionTier ?? null,
              status: sub.status,
            });
          }
        }
      }
      break;
    }
    default:
      // ignore other events
      break;
  }

  return new Response("ok", { status: 200 });
}
