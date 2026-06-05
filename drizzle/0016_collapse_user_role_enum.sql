-- Phase 5.4: collapse user_role from 4 values to 2.
--
-- Pre-flight (run against prod before this commit lands):
--   SELECT DISTINCT role FROM users;             -- only supervisor, supervisee
--   SELECT DISTINCT role FROM org_memberships;   -- only supervisor, supervisee
--   SELECT DISTINCT role FROM invitations;       -- only supervisor, supervisee
--
-- If any row in any table still uses hr_admin or executive, this migration
-- will fail at the column USING cast. Re-role those users first.
--
-- Defensive update — covers the case where the pre-flight was clean but
-- someone created an hr_admin / executive between then and now.
UPDATE "users"
  SET "role" = 'supervisor'
  WHERE "role"::text IN ('hr_admin', 'executive');
UPDATE "org_memberships"
  SET "role" = 'supervisor'
  WHERE "role"::text IN ('hr_admin', 'executive');
UPDATE "invitations"
  SET "role" = 'supervisor'
  WHERE "role"::text IN ('hr_admin', 'executive');

-- Drop every column default that references the old enum type — Postgres
-- can't auto-cast defaults during ALTER COLUMN TYPE even when the literal is
-- valid in the new enum.
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "invitations" ALTER COLUMN "role" DROP DEFAULT;

-- Type-recreate pattern: rename, recreate with the desired values, cast every
-- column over via the intermediate text type, drop the old type.
ALTER TYPE "user_role" RENAME TO "user_role_old";
CREATE TYPE "user_role" AS ENUM ('supervisee', 'supervisor');

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "user_role" USING "role"::text::"user_role";
ALTER TABLE "org_memberships"
  ALTER COLUMN "role" TYPE "user_role" USING "role"::text::"user_role";
ALTER TABLE "invitations"
  ALTER COLUMN "role" TYPE "user_role" USING "role"::text::"user_role";

DROP TYPE "user_role_old";

-- Re-establish the defaults on the new enum.
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'supervisee';
ALTER TABLE "invitations" ALTER COLUMN "role" SET DEFAULT 'supervisee';
