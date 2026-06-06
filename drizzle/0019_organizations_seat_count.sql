-- Phase 7-B: pre-committed seat count for Practice subscriptions.
--
-- Previously Practice tier was uncapped and seats were billed by member-count
-- via syncPracticeSeatQuantity. Going forward, the supervisor picks a seat
-- count at checkout and that becomes the cap. Adding more seats requires
-- editing the subscription quantity (via Stripe Billing Portal).
--
-- The column is nullable: null means "legacy practice org from before the
-- pre-commit migration." seats.ts treats null as unlimited so existing
-- customers keep their current behavior until they update their plan.
ALTER TABLE "organizations"
  ADD COLUMN "seat_count" integer;
