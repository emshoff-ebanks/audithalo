# Microsoft 365 integrations — Teams + Calendar

**Status:** Spec only. Blocked on Damon registering an Entra ID (Azure AD) application.

## What we're shipping eventually

Two MS Graph integrations, both behind the same OAuth flow:

1. **Teams transcripts → AI session notes**
   Supervisor connects their Microsoft 365 account. When they conduct a supervision session via Teams, the meeting transcript flows automatically into AuditHalo's AI-notes pipeline (the same pipeline manual paste uses today). Removes the "paste transcript" friction step.

2. **Outlook Calendar sync**
   Supervisor schedules supervision sessions in Outlook (or AuditHalo creates the calendar event). The session_event row links bi-directionally so reschedules in either system stay in sync.

## What we need from Damon (PRE-WORK BLOCKER)

1. Go to https://portal.azure.com → Microsoft Entra ID → App registrations → New registration
2. Name: **AuditHalo (production)** — repeat as `AuditHalo (staging)` for the staging env
3. Supported account types: **Accounts in any organizational directory (multi-tenant)** — supervisors are in their own tenants
4. Redirect URI (Web):
   - prod: `https://app.audithalo.com/api/auth/ms/callback`
   - staging: `https://staging.app.audithalo.com/api/auth/ms/callback`
5. After registration, on the app page:
   - copy **Application (client) ID**
   - copy **Directory (tenant) ID** (just for reference — we use `common` in code for multi-tenant)
   - go to "Certificates & secrets" → "New client secret" → 24-month expiry → copy the value (only shown once)
   - go to "API permissions" → "Add a permission" → "Microsoft Graph" → "Delegated permissions" → check:
     - `User.Read`
     - `OnlineMeetings.Read`
     - `OnlineMeetingTranscript.Read.All`
     - `Calendars.ReadWrite`
     - `offline_access`
   - click "Grant admin consent for AuditHalo"

Then set these env vars in Vercel (per environment):

```
MS_TENANT_ID=common
MS_CLIENT_ID=<application client id>
MS_CLIENT_SECRET=<client secret value>
MS_REDIRECT_URI=https://app.audithalo.com/api/auth/ms/callback
```

## What we'd build (estimated 1 week post-creds)

### Schema
- New table `user_ms_accounts` — per-user OAuth tokens (access + refresh), encrypted at rest
  - `user_id` PK ref users.id
  - `ms_user_id` text (the Graph user object id, for cross-token correlation)
  - `access_token` text (encrypted)
  - `refresh_token` text (encrypted)
  - `expires_at` timestamptz
  - `scopes` text[] (so we know if a consent re-prompt is needed)
- New column `session_events.teams_meeting_id` text — the Graph onlineMeeting id when a Teams meeting is linked
- New column `session_events.outlook_event_id` text — the Graph calendar event id

### Modules
- `src/lib/ms-graph/auth.ts` — OAuth code flow + token refresh
- `src/lib/ms-graph/teams.ts` — fetch meeting transcript (uses the existing `aiNote.source = "teams"` field added in this release)
- `src/lib/ms-graph/calendar.ts` — create/update/cancel calendar events
- `src/lib/encryption.ts` — column-level encryption for tokens (uses `MS_TOKEN_ENCRYPTION_KEY` env var)

### Routes
- `GET /api/auth/ms/start` — redirects to Entra `/authorize`
- `GET /api/auth/ms/callback` — exchanges code for tokens, stores in `user_ms_accounts`
- `POST /api/integrations/teams/webhook` — Graph change-notification webhook for transcript availability

### UI
- `/dashboard/account#microsoft` — Connect/Disconnect Microsoft 365 button, scope status, last-sync timestamp
- Session log row gets a "Pulled from Teams meeting <id>" badge when source === "teams"
- Calendar tab on /dashboard/roster — view of upcoming scheduled sessions

### Decisions deferred

- **Commercial vs Government cloud**: Default Commercial. GCC High customers need a separate app registration in `microsoftonline.us` and a feature flag.
- **Transcript privacy**: Teams stores transcripts on the customer's M365 tenant by default. We pull, send to OpenAI, never persist. Same posture as manual paste.
- **Calendar event ownership**: When AuditHalo creates the event, who's the organizer — the supervisor or a shared mailbox? Default supervisor; revisit if customers ask for shared inbox.
- **Multi-account support**: One Microsoft account per AuditHalo user for v1. Multi-account (work + personal) is post-launch.

## What's in this release

- Strategy doc (this file)
- `aiNote.source` field with `"teams"` value already supported in the schema (see commit `8c9305f`)
- Placeholder card on `/dashboard/account` linking to this doc

Everything else lands once Damon completes the Entra registration above.
