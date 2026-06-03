-- Track processed Stripe webhook event IDs so we don't double-process when
-- Stripe retries on receiver timeout. The webhook handler inserts the event ID
-- after signature verification; the primary key catches duplicates atomically.

CREATE TABLE "processed_stripe_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
