-- Add Stripe billing fields to organizations.
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" text;
ALTER TABLE "organizations" ADD COLUMN "stripe_subscription_id" text;
ALTER TABLE "organizations" ADD COLUMN "subscription_status" text;
ALTER TABLE "organizations" ADD COLUMN "subscription_tier" text;
ALTER TABLE "organizations" ADD COLUMN "subscription_period_end" timestamp with time zone;
