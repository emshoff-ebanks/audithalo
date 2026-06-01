ALTER TABLE "session_events" ADD COLUMN "signatures" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "session_events" ADD COLUMN "signed_at" timestamp with time zone;