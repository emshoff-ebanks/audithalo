-- Phase 7-A: invite-with-rule + convert-on-accept.
--
-- Supervisors can now pin a state rule (and obligation start dates) at
-- invite-time. When the supervisee accepts, the rule assignment is created
-- atomically with the org_membership — eliminating the "supervisee on roster
-- with no rule" state that today keeps onboarding step 4 perpetually red.
--
-- The three columns mirror the shape of superviseeRuleAssignments inputs:
--
--   pending_rule_id              — e.g. "nc-lcmhca-v1". Null = no rule pinned;
--                                  supervisor will assign manually after accept.
--   pending_obligation_started_at — only meaningful when pending_rule_id is set.
--   pending_contract_filed_at    — optional; only some rules read it.
--
-- All three are nullable so existing rows + old invites that pre-date this
-- migration keep working unchanged.
ALTER TABLE "invitations"
  ADD COLUMN "pending_rule_id" text,
  ADD COLUMN "pending_obligation_started_at" timestamp with time zone,
  ADD COLUMN "pending_contract_filed_at" timestamp with time zone;
