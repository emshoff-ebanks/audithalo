-- Optional TOTP-based two-factor authentication.
-- Adds three columns to `users`:
--   * `totp_secret`        — base32-encoded shared secret (NULL until enabled).
--   * `totp_enabled_at`    — timestamp when 2FA was successfully enabled.
--   * `totp_backup_codes`  — JSON array of SHA-256 hashes of single-use backup
--                           codes. Each code is consumed (spliced out) on use.
--
-- Triggered by:
--   1. User opts in from /dashboard/account → enableTotpAction
--   2. User opts out from /dashboard/account → disableTotpAction
--      (clears all three columns AND bumps sessions_valid_from to force
--      re-login on other devices)
--
-- Login flow (src/auth.ts) checks for a non-null `totp_enabled_at` and, if
-- enabled, requires the credentials provider to also receive a valid 6-digit
-- TOTP code (or a single-use backup code).
ALTER TABLE "users" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_backup_codes" jsonb;
