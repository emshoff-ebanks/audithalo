-- 0029: leave_status on org_memberships.
--
-- Wave 2 / Phase 1.1 — Recovery Innovations + Paycor integration spec.
-- See docs/strategy/13-paycor-integration.md §"2A — Lifecycle state
-- expansion" for the full rationale + Paycor EmploymentStatus -> AuditHalo
-- leaveStatus mapping table.
--
-- Three columns added together as an additive zero-downtime change:
--   - leave_status              non-null enum, defaults to 'active'.
--   - leave_status_changed_at   nullable timestamp.
--   - leave_status_source       nullable text ('manual_hr_admin'|'paycor_sync').
--
-- Default is 'active' so existing rows backfill implicitly. Paycor sync
-- (Phase 3) is the canonical writer for these columns; v1 has no
-- HR-Admin UI flip to avoid drift against Paycor as source of truth.

ALTER TABLE "org_memberships"
  ADD COLUMN IF NOT EXISTS "leave_status" text NOT NULL DEFAULT 'active';
--> statement-breakpoint

-- Constrain to the LEAVE_STATUS enum values from schema.ts. Using a CHECK
-- constraint rather than a Postgres ENUM type keeps the migration shape
-- consistent with the existing `text(..., { enum })` columns elsewhere in
-- schema.ts (which don't materialise PG enums either).
ALTER TABLE "org_memberships"
  ADD CONSTRAINT "org_memberships_leave_status_check"
  CHECK ("leave_status" IN ('active', 'on_leave', 'prn'));
--> statement-breakpoint

ALTER TABLE "org_memberships"
  ADD COLUMN IF NOT EXISTS "leave_status_changed_at" timestamptz;
--> statement-breakpoint

ALTER TABLE "org_memberships"
  ADD COLUMN IF NOT EXISTS "leave_status_source" text;
--> statement-breakpoint

-- Partial index helps roster + sign-reminder queries that scan only
-- supervisees who aren't on leave (the common case). Without it, those
-- queries would full-scan org_memberships once leave_status starts
-- carrying non-'active' values from Paycor sync.
CREATE INDEX IF NOT EXISTS "org_memberships_leave_status_idx"
  ON "org_memberships" ("org_id", "user_id")
  WHERE "leave_status" <> 'active';
