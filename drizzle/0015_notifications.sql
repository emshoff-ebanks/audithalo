-- Phase 5.3: in-app + email notifications.
--
-- Replaces the legacy `notifications` table (vestigial from the original
-- Mongo port — empty in production, never wired into application code). The
-- new shape supports per-kind email opt-out, dedup-by-emailed-at, and the
-- bell-icon unread query.
--
-- read_at  — set when the user reads the notification in the bell
-- emailed_at — set when the email side-effect succeeded; used so the daily
--              cron can skip notifications that were already emailed
--
-- Index supports the bell's "unread for me, newest first" query.
DROP TABLE IF EXISTS "notifications";

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "read_at" timestamp with time zone,
  "emailed_at" timestamp with time zone
);

CREATE INDEX "notifications_user_unread_idx"
  ON "notifications" ("user_id", "created_at" DESC)
  WHERE "read_at" IS NULL;

-- Per-user, per-kind email opt-out. NULL means "use defaults from the schema
-- mirror". Persisted as jsonb so adding a new kind doesn't need a migration.
ALTER TABLE "users"
  ADD COLUMN "notification_prefs" jsonb DEFAULT '{
    "email": {
      "invite_accepted": true,
      "signature_needed": true,
      "rule_changed": true,
      "evidence_sealed": true,
      "supervisor_rule_not_set": false,
      "attestation_overdue": true
    }
  }'::jsonb;
