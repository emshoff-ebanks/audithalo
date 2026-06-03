-- Add AI-generated session note column to session_events. Nullable — existing
-- sessions without notes work unchanged. Stores the structured note + metadata
-- (transcript hash + word count) but NOT the transcript itself.

ALTER TABLE "session_events" ADD COLUMN "ai_note" jsonb;
