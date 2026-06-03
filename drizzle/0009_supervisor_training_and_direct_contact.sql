-- Phase 3 v1.1: add columns supporting two new rule checks.
--   1. users.supervisor_training_hours — self-reported supervisor training hours
--      (e.g., CA 16 CCR §1822 requires 15). Snapshotted onto each supervision
--      session at log time.
--   2. session_events.direct_contact_hours — practice events only. The direct
--      client contact subset of the session's total duration. NULL means treat
--      as equal to duration_hours (backward compat for events logged before
--      this column existed).
--   3. session_events.supervisor_training_hours — supervision events only.
--      Snapshot of the supervisor's verified training hours at the time the
--      session was logged. NULL for legacy events; the supervisor_training
--      check will treat NULL as below threshold, which is the correct
--      behavior — those sessions genuinely can't prove the supervisor had
--      training at the time.
ALTER TABLE "users" ADD COLUMN "supervisor_training_hours" integer;
ALTER TABLE "session_events" ADD COLUMN "direct_contact_hours" double precision;
ALTER TABLE "session_events" ADD COLUMN "supervisor_training_hours" integer;
