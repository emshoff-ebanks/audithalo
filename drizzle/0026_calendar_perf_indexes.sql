-- 0026: Calendar + scheduling performance indexes
--
-- Surfaced by the Phase 5 hostile review. All three queries today scan
-- without an index that fits their shape; under prod load the reminders
-- cron + no-show pass become hot.

-- 1. The reminders cron (/api/cron/scheduled-session-reminders) and the
--    no-show pass in /api/cron/daily-checks both filter session_events
--    by `scheduled_status='scheduled'` AND a date range. A partial
--    index keeps it small (most rows are NULL or non-scheduled status).
CREATE INDEX IF NOT EXISTS "session_events_scheduled_status_date_idx"
  ON "session_events" ("date")
  WHERE "scheduled_status" = 'scheduled';

-- 2. The /dashboard/calendar query pulls session_events by
--    (org_id, date BETWEEN A AND B). For HR Admin views the supervisee
--    filter is an IN over hundreds of ids; the leading (org_id, date)
--    composite handles the date-range portion via index range scan.
CREATE INDEX IF NOT EXISTS "session_events_org_date_idx"
  ON "session_events" ("org_id", "date");

-- 3. The reminders cron dedupes by (user_id, kind, payload->>'sessionId').
--    Without this composite, the cron does a full scan of the user's
--    notifications every 5 minutes per session per attendee. Indexing
--    on (user_id, kind) is enough — the JS filter for the sessionId in
--    the payload is cheap once the row count is small.
CREATE INDEX IF NOT EXISTS "notifications_user_kind_idx"
  ON "notifications" ("user_id", "kind");
