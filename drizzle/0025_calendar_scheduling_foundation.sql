-- 0025: Calendar + scheduling foundation
--
-- Lays the groundwork for the scheduling/calendar feature (docs/strategy/08-
-- scheduling-and-calendar.md). All changes are ADDITIVE — no destructive ops.
-- New columns on session_events are nullable so existing logged sessions stay
-- valid. New tables (user_calendar_integrations, recurring_session_series,
-- session_attendees) start empty. Sub-phase 1a per the strategy doc.

-- ── session_events extensions ────────────────────────────────────────────
ALTER TABLE "session_events"
  ADD COLUMN IF NOT EXISTS "scheduled_status" text,
  ADD COLUMN IF NOT EXISTS "recurring_series_id" uuid,
  ADD COLUMN IF NOT EXISTS "meeting_provider" text,
  ADD COLUMN IF NOT EXISTS "meeting_join_url" text,
  ADD COLUMN IF NOT EXISTS "meeting_id" text,
  ADD COLUMN IF NOT EXISTS "calendar_event_ids" jsonb,
  ADD COLUMN IF NOT EXISTS "time_zone" text,
  ADD COLUMN IF NOT EXISTS "canceled_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "canceled_by_user_id" uuid REFERENCES "users"("id");

-- ── user_calendar_integrations ───────────────────────────────────────────
-- One row per (user, provider). Tokens AES-256-GCM encrypted via the
-- MS_TOKEN_ENCRYPTION_KEY env var (reused for Google per locked decision in
-- 08-scheduling-and-calendar.md). Never store plaintext tokens.
CREATE TABLE IF NOT EXISTS "user_calendar_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,                                  -- 'microsoft' | 'google'
  "account_email" text,
  "access_token" text NOT NULL,                              -- encrypted
  "refresh_token" text,                                      -- encrypted
  "expires_at" timestamp with time zone,
  "scopes" text[] NOT NULL DEFAULT '{}',
  "default_reminder_minutes" integer[] NOT NULL DEFAULT '{60, 15}',
  "sync_supervision_sessions" boolean NOT NULL DEFAULT true,
  "is_preferred" boolean NOT NULL DEFAULT false,             -- per-user picker default
  "connected_at" timestamp with time zone NOT NULL DEFAULT now(),
  "disconnected_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_calendar_integrations_active_unique_idx"
  ON "user_calendar_integrations" ("user_id", "provider")
  WHERE "disconnected_at" IS NULL;

-- ── recurring_session_series (used in Phase 3; table created now so the
--    session_events.recurring_series_id column can carry a FK later) ──────
CREATE TABLE IF NOT EXISTS "recurring_session_series" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "supervisor_id" uuid NOT NULL REFERENCES "users"("id"),
  "supervisee_ids" jsonb NOT NULL,                           -- array of user_ids
  "start_date" date NOT NULL,
  "time_of_day" time NOT NULL,                               -- HH:MM in the series's tz
  "duration_minutes" integer NOT NULL,
  "time_zone" text NOT NULL,
  "frequency" text NOT NULL,                                 -- 'weekly' | 'biweekly' | 'every_3_weeks' | 'monthly'
  "end_type" text NOT NULL,                                  -- 'count' | 'end_date' | 'never'
  "end_count" integer,
  "end_date" date,
  "meeting_provider" text,                                   -- 'teams' | 'google_meet' | 'in_person'
  "location" text,
  "notes" text,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "canceled_at" timestamp with time zone,
  "canceled_by_user_id" uuid REFERENCES "users"("id")
);

-- Now we can add the FK on session_events.recurring_series_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'session_events'
      AND constraint_name = 'session_events_recurring_series_id_fkey'
  ) THEN
    ALTER TABLE "session_events"
      ADD CONSTRAINT "session_events_recurring_series_id_fkey"
      FOREIGN KEY ("recurring_series_id")
      REFERENCES "recurring_session_series"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- ── session_attendees ────────────────────────────────────────────────────
-- For group sessions (Option A from 08-scheduling-and-calendar.md). The
-- primary supervisee stays on session_events.supervisee_id; additional
-- attendees join via this table. ALL attendees must sign before seal.
CREATE TABLE IF NOT EXISTS "session_attendees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_event_id" uuid NOT NULL REFERENCES "session_events"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "is_primary_supervisee" boolean NOT NULL DEFAULT false,    -- mirrors session_events.supervisee_id for the primary
  "added_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE ("session_event_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "session_attendees_session_event_id_idx"
  ON "session_attendees" ("session_event_id");
CREATE INDEX IF NOT EXISTS "session_attendees_user_id_idx"
  ON "session_attendees" ("user_id");
