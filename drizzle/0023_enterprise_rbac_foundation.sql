-- 0023: Enterprise RBAC foundation.
--
-- Adds the multi-supervisor role model that powers the Enterprise tier:
--   • Extends user_role enum with 'hr_admin' and 'executive' (Phase 5.4 had
--     collapsed it to 2 values; we're re-expanding intentionally).
--   • Explicit supervisor↔supervisee assignment table — M:N because one
--     supervisee can have a primary + secondary supervisor.
--   • Org-level settings table for retention prefs, SSO config, branding,
--     and the "allow supervisors to invite" toggle.
--   • Soft-deactivation on memberships (audit trail stays intact when a
--     supervisor leaves the practice).
--
-- All changes are ADDITIVE — no destructive operations. If something goes
-- wrong post-merge we can DROP the new tables / columns and revert the
-- enum via the same type-recreate pattern.
--
-- See docs/strategy/04-enterprise-rbac.md for the role matrix, workflows,
-- and edge cases this schema supports.

-- ── enum extension (type-recreate pattern; ADD VALUE doesn't work inside
--    transactions, which repair-migrations.ts wraps everything in) ────────
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "org_memberships" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "invitations" ALTER COLUMN "role" DROP DEFAULT;

ALTER TYPE "user_role" RENAME TO "user_role_old";
CREATE TYPE "user_role" AS ENUM (
  'supervisee',
  'supervisor',
  'hr_admin',
  'executive'
);

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "user_role" USING "role"::text::"user_role";
ALTER TABLE "org_memberships"
  ALTER COLUMN "role" TYPE "user_role" USING "role"::text::"user_role";
ALTER TABLE "invitations"
  ALTER COLUMN "role" TYPE "user_role" USING "role"::text::"user_role";

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'supervisee'::user_role;
ALTER TABLE "org_memberships" ALTER COLUMN "role" SET DEFAULT 'supervisee'::user_role;
ALTER TABLE "invitations" ALTER COLUMN "role" SET DEFAULT 'supervisee'::user_role;

DROP TYPE "user_role_old";

-- ── supervisor_assignments — explicit M:N pairing ─────────────────────────
CREATE TABLE IF NOT EXISTS "supervisor_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "supervisor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "supervisee_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "is_primary" boolean NOT NULL DEFAULT true,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "ended_at" timestamp with time zone,
  "transferred_from_supervisor_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Active-pairing uniqueness — partial unique index over rows where the
-- assignment is still in effect (ended_at IS NULL). Avoids two active
-- primary supervisors for the same supervisee within one org.
CREATE UNIQUE INDEX IF NOT EXISTS "supervisor_assignments_active_unique_idx"
  ON "supervisor_assignments" ("org_id", "supervisor_id", "supervisee_id")
  WHERE "ended_at" IS NULL;

CREATE INDEX IF NOT EXISTS "supervisor_assignments_supervisee_active_idx"
  ON "supervisor_assignments" ("supervisee_id") WHERE "ended_at" IS NULL;
CREATE INDEX IF NOT EXISTS "supervisor_assignments_supervisor_active_idx"
  ON "supervisor_assignments" ("supervisor_id") WHERE "ended_at" IS NULL;

-- ── soft-deactivation on memberships ──────────────────────────────────────
ALTER TABLE "org_memberships"
  ADD COLUMN IF NOT EXISTS "deactivated_at" timestamp with time zone;
ALTER TABLE "org_memberships"
  ADD COLUMN IF NOT EXISTS "deactivated_by_user_id" uuid REFERENCES "users"("id");

-- ── org_settings (one row per org) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "org_settings" (
  "org_id" uuid PRIMARY KEY REFERENCES "organizations"("id") ON DELETE CASCADE,
  "audit_log_retention_years" integer NOT NULL DEFAULT 7,
  "sso_provider" text,
  "sso_metadata_url" text,
  "branding_logo_url" text,
  "allow_supervisors_to_invite" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- ── backfills ─────────────────────────────────────────────────────────────

-- One org_settings row per existing org.
INSERT INTO "org_settings" ("org_id")
SELECT "id" FROM "organizations"
ON CONFLICT ("org_id") DO NOTHING;

-- One supervisor_assignments row per existing supervisor → supervisee pair
-- in the same org. is_primary=true since today's model assumes 1:1.
INSERT INTO "supervisor_assignments"
  ("org_id", "supervisor_id", "supervisee_id", "is_primary", "started_at")
SELECT
  sup."org_id",
  sup."user_id" AS supervisor_id,
  sve."user_id" AS supervisee_id,
  true,
  GREATEST(sup."created_at", sve."created_at") AS started_at
FROM "org_memberships" sup
JOIN "org_memberships" sve ON sve."org_id" = sup."org_id"
WHERE sup."role" = 'supervisor'
  AND sve."role" = 'supervisee'
ON CONFLICT DO NOTHING;
