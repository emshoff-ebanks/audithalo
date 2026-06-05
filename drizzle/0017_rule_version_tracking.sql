-- Phase 6.0: rule version drift detection.
--
-- When a state board publishes a new rule version (a new vN.yaml lands in
-- /rules/<jur-license>/), supervisees keep their existing assignment.ruleId
-- until a supervisor explicitly applies the new version. The daily cron
-- detects assignments whose version is older than the latest available and
-- fires a rule_changed notification.
--
-- users.auto_apply_rule_updates — opt-in per supervisor. When true, the cron
--   bumps the assignment.ruleId AND sends the notification (heads-up that
--   the move happened). Default false so we don't silently re-version
--   in-progress hours.
--
-- supervisee_rule_assignments.rule_change_snoozed_at — when a supervisor
--   clicks "Keep on v1 for now", set to current time. The cron skips
--   notifications for 30 days afterward to avoid badgering.
ALTER TABLE "users"
  ADD COLUMN "auto_apply_rule_updates" boolean NOT NULL DEFAULT false;

ALTER TABLE "supervisee_rule_assignments"
  ADD COLUMN "rule_change_snoozed_at" timestamp with time zone;
