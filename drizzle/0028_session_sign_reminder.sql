-- 0028: sign_reminder_sent_at on session_events.
--
-- Cycle: scheduling — replace the daily auto-no-show flip with a more
-- frequent "time to sign" reminder. The new poll cron fires when a
-- session's end time has just passed; this column lets it dedupe so a
-- single session only triggers one reminder no matter how often the
-- cron runs.
--
-- Also doubles as the reset signal on reschedule: when a session's
-- date moves, the action nulls this column so the reminder fires again
-- after the new end time.

ALTER TABLE "session_events"
  ADD COLUMN IF NOT EXISTS "sign_reminder_sent_at"
    timestamptz;

-- Helps the cron's window query: scan only rows that haven't been
-- reminded AND are still in flight. Partial index keeps it tight —
-- most rows are either already signed or canceled long-term.
CREATE INDEX IF NOT EXISTS "session_events_sign_reminder_due_idx"
  ON "session_events" ("date", "duration_hours")
  WHERE
    "scheduled_status" = 'scheduled'
    AND "signed_at" IS NULL
    AND "sign_reminder_sent_at" IS NULL;
