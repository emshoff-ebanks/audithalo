-- In-person recording transcript (strategy doc 22).
-- Raw text from Whisper transcription, Teams/Meet fetch, or manual paste.
ALTER TABLE session_events
  ADD COLUMN transcript TEXT,
  ADD COLUMN transcript_source TEXT;
