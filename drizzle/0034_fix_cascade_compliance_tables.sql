-- 0034: Fix CASCADE deletes on compliance-critical tables.
--
-- Problem: Deleting a user would CASCADE-delete their supervision
-- sessions, evidence packages, audit log entries, and assignments.
-- These are compliance records that must outlive user deletion.
--
-- Fix: Change to SET NULL (data preserved, FK nulled) or RESTRICT
-- (block deletion if referenced). Make affected FK columns nullable.

-- session_events.supervisee_id: cascade -> set null
ALTER TABLE session_events ALTER COLUMN supervisee_id DROP NOT NULL;
ALTER TABLE session_events DROP CONSTRAINT session_events_supervisee_id_users_id_fk;
ALTER TABLE session_events ADD CONSTRAINT session_events_supervisee_id_users_id_fk
  FOREIGN KEY (supervisee_id) REFERENCES users(id) ON DELETE SET NULL;

-- evidence_packages.supervisee_id: cascade -> set null
ALTER TABLE evidence_packages ALTER COLUMN supervisee_id DROP NOT NULL;
ALTER TABLE evidence_packages DROP CONSTRAINT evidence_packages_supervisee_id_users_id_fk;
ALTER TABLE evidence_packages ADD CONSTRAINT evidence_packages_supervisee_id_users_id_fk
  FOREIGN KEY (supervisee_id) REFERENCES users(id) ON DELETE SET NULL;

-- evidence_packages.session_event_id: cascade -> restrict
ALTER TABLE evidence_packages DROP CONSTRAINT evidence_packages_session_event_id_session_events_id_fk;
ALTER TABLE evidence_packages ADD CONSTRAINT evidence_packages_session_event_id_session_events_id_fk
  FOREIGN KEY (session_event_id) REFERENCES session_events(id) ON DELETE RESTRICT;

-- supervisee_rule_assignments.supervisee_id: cascade -> set null
ALTER TABLE supervisee_rule_assignments ALTER COLUMN supervisee_id DROP NOT NULL;
ALTER TABLE supervisee_rule_assignments DROP CONSTRAINT supervisee_rule_assignments_supervisee_id_users_id_fk;
ALTER TABLE supervisee_rule_assignments ADD CONSTRAINT supervisee_rule_assignments_supervisee_id_users_id_fk
  FOREIGN KEY (supervisee_id) REFERENCES users(id) ON DELETE SET NULL;

-- supervisor_assignments.supervisor_id: cascade -> set null
ALTER TABLE supervisor_assignments ALTER COLUMN supervisor_id DROP NOT NULL;
ALTER TABLE supervisor_assignments DROP CONSTRAINT supervisor_assignments_supervisor_id_users_id_fk;
ALTER TABLE supervisor_assignments ADD CONSTRAINT supervisor_assignments_supervisor_id_users_id_fk
  FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL;

-- supervisor_assignments.supervisee_id: cascade -> set null
ALTER TABLE supervisor_assignments ALTER COLUMN supervisee_id DROP NOT NULL;
ALTER TABLE supervisor_assignments DROP CONSTRAINT supervisor_assignments_supervisee_id_users_id_fk;
ALTER TABLE supervisor_assignments ADD CONSTRAINT supervisor_assignments_supervisee_id_users_id_fk
  FOREIGN KEY (supervisee_id) REFERENCES users(id) ON DELETE SET NULL;
