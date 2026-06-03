-- Counseling Compact + Social Work Compact foundation.
-- Adds optional two-letter US state code to practice events so we know which
-- state each practice block happened in. NULL means "assume supervisee's
-- current state" — correct backward compat for events logged before this
-- column existed and for the common case where the supervisee never moved.
-- No new rule logic uses this field yet; encoding the per-state compact
-- provisions (TX HB 4533, Counseling Compact 2024 go-live, Social Work
-- Compact 2025-26 rolling) requires licensed-supervisor research per
-- jurisdiction.
ALTER TABLE "session_events" ADD COLUMN "practice_state" text;
