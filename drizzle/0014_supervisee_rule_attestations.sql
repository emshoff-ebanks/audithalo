-- Phase 5.2: per-assignment attestation storage so gaps can be "marked done"
-- without forcing the supervisor to re-enter the same fact every evaluation.
--
-- Two flavors:
--   1. Typed columns for known checks the rule engine reads from directly
--      (permit window, supervisor training). These let the evaluator stay pure
--      and well-typed instead of probing a jsonb bag for known keys.
--   2. A generic `attestations` jsonb bag for future-extensible per-check
--      attestations whose shape we haven't decided yet. NULL means empty bag.
--
-- Shape of attestations (when populated):
--   { "<checkId>": { "attestedAt": ISO, "attestedBy": userId, "value": ... } }
ALTER TABLE "supervisee_rule_assignments"
  ADD COLUMN "permit_issued_at" timestamp with time zone,
  ADD COLUMN "permit_expires_at" timestamp with time zone,
  ADD COLUMN "supervisor_training_completed_at" timestamp with time zone,
  ADD COLUMN "supervisor_training_hours_attested" integer,
  ADD COLUMN "attestations" jsonb;
