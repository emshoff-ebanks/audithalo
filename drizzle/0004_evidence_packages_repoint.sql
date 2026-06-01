-- Repoint evidence_packages to session_events and org-scope it.
-- The old table referenced the legacy `sessions` table from the Mongo port.
-- This rebuild makes evidence_packages first-class: one per signed session_event,
-- carrying the rule citation, signatures, canonical document and SHA-256 hash.

DROP TABLE IF EXISTS "evidence_packages" CASCADE;

CREATE TABLE "evidence_packages" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "session_event_id" uuid NOT NULL UNIQUE,
  "org_id" uuid NOT NULL,
  "supervisee_id" uuid NOT NULL,
  "rule_id" text NOT NULL,
  "signatures" jsonb NOT NULL,
  "document_hash" text NOT NULL,
  "document_content" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "evidence_packages"
  ADD CONSTRAINT "evidence_packages_session_event_id_fk"
  FOREIGN KEY ("session_event_id") REFERENCES "session_events"("id") ON DELETE CASCADE;

ALTER TABLE "evidence_packages"
  ADD CONSTRAINT "evidence_packages_org_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

ALTER TABLE "evidence_packages"
  ADD CONSTRAINT "evidence_packages_supervisee_id_fk"
  FOREIGN KEY ("supervisee_id") REFERENCES "users"("id") ON DELETE CASCADE;
