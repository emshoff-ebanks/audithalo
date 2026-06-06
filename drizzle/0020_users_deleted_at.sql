-- Pre-beta gap §2d: account deletion.
--
-- Users get a "Delete my account" button on /dashboard/account. Clicking it
-- sets users.deleted_at = now() (soft-delete). The user is immediately signed
-- out and existing sessions stop authenticating (auth.ts callback rejects).
-- A daily cron purges rows where deleted_at < now() - 30 days, giving the
-- user a recovery window if they change their mind.
--
-- A partial index over the small subset of soft-deleted rows makes the cron's
-- purge query cheap regardless of total table size.
ALTER TABLE "users"
  ADD COLUMN "deleted_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "users_deleted_at_idx"
  ON "users" ("deleted_at")
  WHERE "deleted_at" IS NOT NULL;
