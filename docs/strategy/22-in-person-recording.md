# 22 — In-Person Session Recording + Transcription

> **Status:** Planning
> **Priority:** High (from Damon's Sep 1 call)
> **Depends on:** Signing order enforcement (shipped), OpenAI SDK (already integrated)

---

## Summary

Supervisors conducting in-person supervision sessions need a way to record
the session and generate a transcript — all through the AuditHalo app. The
transcript is a first-class artifact the supervisor reads, verifies, and
edits. The AI session note is optional and secondary.

## Design principles

1. **Transcript is the primary output, not the AI note.** The user reads it.
2. **Audio is never stored permanently.** Processed for transcription, then discarded.
3. **Two-party consent required.** Both supervisor and supervisee must acknowledge.
4. **Supervisor edits the transcript** before it's finalized (fix misheard names, etc.).
5. **Keep it in-app.** Phase 1 uses OpenAI Whisper with zero retention. Phase 2 moves to self-hosted.

## User flow

1. Supervisor opens sign page for an in-person session
2. Clicks "Record in-person session"
3. Consent screen: both parties check a box
4. Recording starts (red indicator, elapsed timer, waveform)
5. Session happens (30-60 min)
6. Supervisor clicks "Stop recording"
7. Audio uploads to server → Whisper API → transcript returned
8. Raw transcript displayed — supervisor reads and edits
9. "Save transcript" locks it on the session record
10. "Generate AI note" button feeds transcript into existing pipeline
11. Audio discarded after transcription completes

## Technical architecture

### Recording (client)
- MediaRecorder API, `audio/webm;codecs=opus` at 32kbps mono
- 1-hour session at 32kbps ≈ 14MB (within Whisper's 25MB limit)
- Chunked upload if needed (but 14MB is fine for a single POST)
- Waveform visualization via AnalyserNode on the AudioContext
- Auto-stop safety: cap at 90 minutes with warning at 75 min

### Permission handling
- Pre-check via Permissions API (Chrome/Edge), with try/catch for Firefox
- Distinguish "denied" from "dismissed" via post-check after NotAllowedError
- Show browser-specific recovery instructions when denied
- Guard for HTTPS requirement (navigator.mediaDevices undefined on HTTP)
- Handle "device in use" (NotReadableError) with clear messaging

### Consent UI
- Both-party consent modal before recording starts
- Checkbox: "I confirm that both parties present consent to this recording"
- Reference to state wiretapping laws (all AuditHalo states are one-party
  or all-party consent — CA, FL, WA are all-party)
- Consent is logged as an audit event

### Transcription (server)
- POST /api/transcribe — accepts audio blob, authenticated
- Sends to OpenAI Whisper API (model: whisper-1)
- Zero data retention via OpenAI API config
- Returns plain text transcript with timestamps
- Gated by the same AI quota system as AI notes

### Transcript storage
- New field on session_events: `transcript` (nullable text)
- New field: `transcriptSource` ('recording' | 'teams' | 'google_meet' | 'manual')
- The existing `aiNote` field stays separate — transcript is the raw text,
  AI note is the structured summary

### Permissions-Policy update
- Current: `camera=(), microphone=()`
- After: `camera=(), microphone=(self)` — allow microphone on own origin

## Schema changes

```sql
ALTER TABLE session_events
  ADD COLUMN transcript TEXT,
  ADD COLUMN transcript_source TEXT;
```

## Files to create/modify

### New files
- `src/components/app/record-session-panel.tsx` — recording UI
- `src/app/api/transcribe/route.ts` — Whisper API endpoint
- `src/components/app/transcript-editor.tsx` — view/edit transcript

### Modified files
- `src/app/app/sign/[sessionId]/page.tsx` — add recording option for in-person sessions
- `src/lib/db/schema.ts` — add transcript + transcriptSource columns
- `next.config.ts` — update Permissions-Policy to allow microphone
- `src/app/actions/ai-note.ts` — accept transcript from recording (not just paste/fetch)

## Phase 2 (future)
- Self-hosted Whisper on GPU compute (audio never leaves our infra)
- Speaker diarization (label who said what)
- Real-time streaming transcription during the session
