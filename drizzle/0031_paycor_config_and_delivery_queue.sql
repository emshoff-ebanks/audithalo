-- Wave 2 Phase 2: Paycor integration infrastructure.
-- Adds per-org Paycor connection config and the SFTP delivery queue.
-- See docs/strategy/14-wave2-phase2-scaffolding.md.

-- Per-org Paycor connection details. Null = not connected.
-- Contains legalEntityId, SFTP host/user/basePath.
ALTER TABLE "organizations" ADD COLUMN "paycor_config" jsonb;

-- SFTP delivery queue for sealed evidence packages.
-- Worker cron picks up pending rows and pushes PDFs to Paycor.
CREATE TABLE "paycor_delivery_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "evidence_package_id" uuid NOT NULL REFERENCES "evidence_packages"("id") ON DELETE CASCADE,
  "paycor_employee_id" text,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Partial index for the cron worker: only scan pending rows.
CREATE INDEX "idx_delivery_queue_pending"
  ON "paycor_delivery_queue" ("status", "created_at")
  WHERE "status" = 'pending';
