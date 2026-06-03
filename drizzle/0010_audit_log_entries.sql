-- Per-organization audit log: append-only record of who-did-what-when for
-- every state-changing action. Fulfills the Practice tier promise of
-- "audit log retention (7 years)" and lays the groundwork for SOC 2 controls.
--
-- The index on (org_id, created_at DESC) supports the most common query:
-- "show me my org's recent audit log."
CREATE TABLE IF NOT EXISTS "audit_log_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "action" text NOT NULL,
  "resource_type" text,
  "resource_id" text,
  "details" jsonb,
  "ip_address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_log_org_created_idx"
  ON "audit_log_entries" ("org_id", "created_at" DESC);
