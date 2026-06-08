-- 0024: HR Admin picks a supervisor at invite-time.
--
-- Per docs/strategy/04-enterprise-rbac.md §"Inviting a Supervisee" #1:
-- HR Admin's invite form gets an "Assign to supervisor" dropdown. On
-- accept, the supervisee gets a supervisor_assignments row with the
-- picked supervisor immediately (no orphaned-supervisee gap).
--
-- Supervisor's own invite flow auto-assigns to themselves (no dropdown
-- shown), so for those invites this column stays NULL — the accept-invite
-- path falls back to "the inviter is the supervisor."
--
-- Nullable so existing invitations stay valid.
ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "pending_assignment_supervisor_id"
    uuid REFERENCES "users"("id");
