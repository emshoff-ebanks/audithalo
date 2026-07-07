# 3G — Auto-Transcription from Google Meet / Microsoft Teams

> Written 2026-07-07. Read `AGENTS.md` first. This builds on top of
> the existing calendar infrastructure in `src/lib/calendar/`.

## What this does for the user

Today, after a supervision meeting ends, the supervisor goes to the
sign page and manually pastes a transcript. Then AuditHalo's AI
generates a structured note (topics, competencies, feedback, next
steps) from that transcript.

After this feature ships: the supervisor goes to the sign page and
clicks one button — "Generate note from meeting." AuditHalo fetches
the transcript directly from Google Meet or Microsoft Teams, runs the
AI, and populates the note. The supervisor reviews, edits if needed,
and signs. No copy-pasting.

For RI orgs, the AI note also pre-populates parts of the Clinical
Supervision Form (action steps, group discussion topics, additional
context) — this already works and doesn't change.

## What we already have (don't rebuild)

| Component | File | What it does |
|---|---|---|
| Google Calendar OAuth | `src/lib/calendar/providers/google.ts` | Creates events, mints Meet links, conflict detection |
| MS Teams OAuth | `src/lib/calendar/providers/microsoft.ts` | Creates events, provisions Teams meetings, conflict detection |
| Token storage + refresh | `src/lib/calendar/token-refresh.ts` | Auto-refreshes expired tokens, handles rotation |
| OAuth scopes config | `src/lib/calendar/oauth-config.ts` | Centralized scope definitions per provider |
| AI note pipeline | `src/lib/ai/session-note.ts` | Takes raw transcript text, outputs structured note. Already accepts `source: "teams"` param. |
| AI note action | `src/app/actions/ai-note.ts` | Server action for generating/editing notes. Quota-gated. |
| Session schema | `src/lib/db/schema.ts` | `meetingProvider`, `meetingId`, `meetingJoinUrl` stored per session. `aiNote` JSONB already has `source` + `teamsMeetingId` fields. |

## What needs to change

### 1. OAuth scope upgrades

**Microsoft Teams:**
- **Current scopes:** `Calendars.ReadWrite`, `OnlineMeetings.ReadWrite`
- **Need to add:** `OnlineMeetingTranscript.Read.All`
- **Catch:** This scope requires **admin consent** in most Azure AD tenants. The RI Entra admin would need to approve it once. Existing users need to re-consent (disconnect + reconnect their Teams integration).

**Google Meet:**
- **Current scopes:** `calendar.events`, `calendar.readonly`
- **Need to add:** `https://www.googleapis.com/auth/drive.readonly` (Meet transcripts land as Google Docs in Drive)
- **Catch:** Google's `include_granted_scopes=true` is already set in our OAuth config, so incremental consent is supported — the user sees a prompt for the new scope without losing their calendar connection.

**Implementation:** Update `src/lib/calendar/oauth-config.ts` to add the new scopes. For Microsoft, add a check in the transcript-fetch code that validates the stored scopes include transcript access, and show "Reconnect Teams to enable transcript access" if not.

### 2. Meeting ID resolution (Microsoft)

**Problem:** When we create a Teams meeting via `POST /me/events` with `isOnlineMeeting: true`, the response gives us the calendar event ID. But the transcript API needs the `onlineMeetingId`, which is a different value.

**Solution:** Before fetching a transcript, resolve the meeting ID:
```
GET /me/onlineMeetings?$filter=JoinWebUrl eq '{meetingJoinUrl}'
```
This returns the `onlineMeeting` object with its `id`, which is what the transcript API needs. We already store `meetingJoinUrl` on every session event, so this is a simple lookup.

Cache the resolved `onlineMeetingId` back onto `sessionEvents.meetingId` so we don't repeat the lookup.

### 3. Transcript fetch methods

Add a `getTranscript` method to each provider client:

**Microsoft Teams:**
```
1. Resolve onlineMeetingId from joinUrl (see above)
2. GET /me/onlineMeetings/{meetingId}/transcripts
   → returns list of transcript objects
3. GET /me/onlineMeetings/{meetingId}/transcripts/{transcriptId}/content
   with Accept: text/vtt
   → returns the VTT transcript text
4. Parse VTT → plain text (strip timing cues)
```

**Google Meet:**
```
1. Search Drive for the transcript doc:
   GET /drive/v3/files?q=name contains '{meetingTitle}' and
   mimeType='application/vnd.google-apps.document'
   (Google auto-creates a doc named "Meeting transcript - {title}")
2. GET /drive/v3/files/{fileId}/export?mimeType=text/plain
   → returns plain text transcript
```

**New interface method:**
```ts
interface CalendarProviderClient {
  // ... existing methods
  getTranscript?(meetingId: string, joinUrl: string): Promise<string | null>;
}
```

Optional method — returns `null` if transcript isn't available yet
(meeting still in progress, or provider hasn't processed it).

### 4. New server action

**`fetchTranscriptAndGenerateNoteAction(sessionEventId: string)`**

This replaces the manual paste flow for sessions with a meeting provider:

1. Auth + permission check (same as `generateSessionNoteAction`)
2. Load the session event — must have `meetingProvider` + `meetingJoinUrl`
3. Get the provider client for the hosting supervisor (not the viewer — the supervisor who owns the calendar integration)
4. Call `client.getTranscript(meetingId, meetingJoinUrl)`
5. If transcript not available: return `{ ok: false, error: "Transcript not ready yet. Try again in a few minutes." }`
6. Feed transcript to `generateSessionNote({ transcript, source: meetingProvider === "teams" ? "teams" : "google_meet", teamsMeetingId: meetingId })`
7. Save to `sessionEvents.aiNote`
8. Revalidate the sign page

### 5. Sign page UI changes

The AI note section currently shows either the paste form or the generated note. For sessions with a meeting provider, add a third option:

**Before transcript fetch:**
```
┌──────────────────────────────────────────┐
│  AI session note                         │
│                                          │
│  This session was held via Google Meet.   │
│                                          │
│  [Generate note from meeting transcript] │
│                                          │
│  Or paste a transcript manually ▾        │
└──────────────────────────────────────────┘
```

**After transcript fetch:**
```
┌──────────────────────────────────────────┐
│  AI session note                         │
│  Source: Google Meet transcript     ✓    │
│                                          │
│  Topics covered                          │
│  • ...                                   │
│  Competencies addressed                  │
│  • ...                                   │
│  (same display as today)                 │
└──────────────────────────────────────────┘
```

The "Generate note from meeting transcript" button replaces the
paste textarea. If the supervisor prefers to paste manually, they
click "Or paste a transcript manually" which reveals the existing
form.

For sessions without a meeting provider (logged as past sessions,
or in-person), nothing changes — they see the paste form as today.

### 6. When does the transcript become available?

**Microsoft Teams:** Transcripts are available after the meeting ends
AND the organizer had transcription enabled (a Teams setting). They
typically appear within 1-5 minutes of the meeting ending.

**Google Meet:** Transcripts are created when recording is enabled.
They appear in Drive as a Google Doc within a few minutes of the
meeting ending.

**UX implication:** The supervisor might click "Generate note" before
the transcript is ready. The action returns a friendly error:
"The meeting transcript isn't available yet — it usually takes a
few minutes after the meeting ends. Try again shortly." This is
NOT an error state — it's expected.

### 7. What if transcription wasn't enabled?

If the meeting organizer didn't enable transcription in Teams or
recording in Meet, there's no transcript to fetch. The action returns:
"No transcript found for this meeting. You can paste a transcript
manually instead." The paste form becomes the fallback.

## Implementation passes

### Pass 1 — OAuth scope upgrade + re-consent detection (~2 hrs)

- Update `oauth-config.ts` with new scopes
- Add scope detection: `hasTranscriptScope(integration)` helper
- On the sign page, check if the supervisor's integration has
  transcript scopes. If not, show "Reconnect [Teams/Meet] to
  enable auto-transcription" link instead of the fetch button.

### Pass 2 — Transcript fetch methods (~3 hrs)

- Add `getTranscript` to the `CalendarProviderClient` interface
- Implement for Microsoft: meeting ID resolution + transcript content fetch + VTT parsing
- Implement for Google: Drive search + doc export
- Unit tests with mocked HTTP responses

### Pass 3 — Server action + sign page UI (~3 hrs)

- `fetchTranscriptAndGenerateNoteAction` server action
- Sign page: "Generate note from meeting transcript" button
- Fallback: "Or paste manually" toggle
- Source badge on generated notes ("From Teams transcript" / "From Google Meet")
- Loading state during transcript fetch + AI generation

### Pass 4 — Testing + edge cases (~2 hrs)

- Test: transcript not available yet (graceful error)
- Test: transcription not enabled (fallback to manual)
- Test: token expired during fetch (auto-refresh)
- Test: supervisor who scheduled ≠ supervisor who views (use hosting supervisor's token)
- Test: transcript too long (> 50K chars) — truncation already handled by pipeline

## Effort estimate

| Pass | Effort |
|---|---|
| 1 — OAuth scopes | ~2 hrs |
| 2 — Transcript fetch | ~3 hrs |
| 3 — Action + UI | ~3 hrs |
| 4 — Testing | ~2 hrs |
| **Total** | **~10 hrs (2 sessions)** |

## What this does NOT cover

- Automatic fetching (no supervisor button click) — future enhancement
- Zoom support — would need a third provider adapter
- Recording/playback in AuditHalo — we fetch the transcript text only
- Transcript storage — transcripts are NOT stored, only the AI note (same as today)

## Dependencies

- No external blockers for the code
- RI's Teams admin needs to approve the `OnlineMeetingTranscript.Read.All` scope (one-time)
- Google users need to re-consent for Drive access (incremental, one-click)

## References

- Calendar infrastructure: `src/lib/calendar/`
- AI note pipeline: `src/lib/ai/session-note.ts`
- Sign page: `src/app/app/sign/[sessionId]/page.tsx`
- MS Graph transcript API: `GET /me/onlineMeetings/{id}/transcripts`
- Google Drive export API: `GET /drive/v3/files/{id}/export`
