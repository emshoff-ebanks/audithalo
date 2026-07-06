-- 0030: PDF template key + clinical supervision form fields.
--
-- Wave 2 / 2E — RI Clinical Supervision Form. Three additive columns,
-- zero-downtime, no backfill required.
--
-- 1. organizations.pdf_template_key — which PDF layout to render on seal.
--    Default 'audithalo_generic' preserves existing behavior. RI orgs get
--    set to 'recovery_innovations_v1' via a separate data migration.
--
-- 2. session_events.supervision_type — Peer/Nursing/Clinician/Administrative/
--    APP/Other. Useful across all orgs, required for RI.
--
-- 3. session_events.clinical_form_data — JSONB holding the RI Clinical
--    Supervision Form structured data (competency checkboxes, action steps,
--    case review, etc.). See src/lib/clinical-form/types.ts.

ALTER TABLE "organizations"
  ADD COLUMN "pdf_template_key" text NOT NULL DEFAULT 'audithalo_generic';

ALTER TABLE "session_events"
  ADD COLUMN "supervision_type" text;

ALTER TABLE "session_events"
  ADD COLUMN "clinical_form_data" jsonb;
