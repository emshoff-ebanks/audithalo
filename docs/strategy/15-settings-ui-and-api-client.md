# Wave 2 Phase 3 — Settings UI + Real Paycor API Client

> Written 2026-07-07. Read `AGENTS.md`, then `docs/strategy/13-paycor-integration.md`,
> then `docs/strategy/14-wave2-phase2-scaffolding.md`, then this doc. Memory auto-loads.

## Why this doc exists

Phase 2 scaffolding shipped (commit `d6342f3`). The mock providers work
but can't talk to real Paycor servers. This plan covers the two things
we can build RIGHT NOW without waiting for RI's credentials:

1. A Settings UI where HR Admin enters Paycor credentials
2. A real API client that talks to Paycor's sandbox or production servers

Both are tested against mocked HTTP responses in unit tests. When RI
provides real credentials, we paste them into the Settings UI and
everything lights up — no additional code needed.

This plan also covers the 3 bug fixes identified in the Phase 2 audit.

## How this affects the app from a human's perspective

### What changes for the HR Admin

**Before this work:** There's a "Paycor Integration — Not connected" card
on the dashboard but no way to actually connect. It's a placeholder.

**After this work:** HR Admin goes to Settings → Integrations → Paycor,
enters the credentials they got from Chris (their Paycor admin), clicks
"Test Connection" to verify, then "Connect." From that point forward,
the daily sync cron starts pulling employee data and the SFTP delivery
starts pushing sealed PDFs.

### What changes for Supervisors and Supervisees

Nothing. They never see the Settings page or interact with Paycor
credentials. The sync and delivery happen invisibly.

### What changes for non-RI orgs

Nothing. The Settings UI only shows the Paycor card if the org has
an Enterprise tier (or is RI's custom plan). Solo/Practice tier orgs
don't see it.

### Side effects on existing features

| Feature | Impact |
|---|---|
| Dashboard | No change — the existing Paycor panel already works with whatever paycorConfig holds |
| Audit log | 2 new entries: `paycor.connected`, `paycor.disconnected` |
| Sync cron | Currently skips all orgs (mock provider returns empty). After settings are filled, it calls the real API for that org. Other orgs still skipped. |
| SFTP delivery | Currently uses mock transport. Real SFTP transport plugs in separately (blocked on SFTP creds). |
| Billing | No impact |
| Auth | No impact — settings page is HR Admin gated |

## What's done (context for the new session)

- Phase 2 scaffolding: `PaycorChange` types, `applyPaycorChange()`,
  `diffRoster()`, delivery queue, cron endpoints, mock providers,
  audit log codes, 56 tests.
- Migration 0031 applied (paycorConfig JSONB + delivery queue table).
- RI test org seeded with `pdf_template_key = 'recovery_innovations_v1'`.
- 2E Clinical Supervision Form PDF: complete.
- Paycor swagger v1/v2 at `docs/paycor/`.

## Implementation passes

### Pass 1 — Expand PaycorConfig type + migration (~1 hr)

The current `PaycorConfig` in `schema.ts` is a minimal stub with 4
fields. Expand it to hold all credential and state fields:

```ts
type PaycorConfig = {
  // Connection identity
  legalEntityId: string;
  environment: 'sandbox' | 'production';

  // API auth (encrypted at app layer via src/lib/crypto.ts)
  apimSubscriptionKey: string;     // encrypted
  oauthClientId: string;
  oauthClientSecret: string;       // encrypted
  oauthAccessToken?: string;       // encrypted, auto-managed
  oauthRefreshToken?: string;      // encrypted, auto-managed
  tokenExpiresAt?: string;         // ISO timestamp

  // SFTP delivery (encrypted, populated later when creds arrive)
  sftpHost?: string;
  sftpUser?: string;
  sftpPrivateKey?: string;         // encrypted
  sftpBasePath?: string;

  // Metadata
  connectedAt: string;             // ISO timestamp
  connectedByUserId: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'partial' | 'failed';
  lastSyncChanges?: number;
};
```

Also add `paycor_employee_id` to `org_memberships` (migration 0032):

```sql
ALTER TABLE org_memberships ADD COLUMN paycor_employee_id text;
CREATE INDEX idx_org_memberships_paycor_eid
  ON org_memberships (paycor_employee_id)
  WHERE paycor_employee_id IS NOT NULL;
```

This enables matching by Paycor ID instead of email alone.

### Pass 2 — Real Paycor API client (~3 hrs)

New file: `src/lib/hris/paycor-api-client.ts`

Implements the existing `PaycorProvider` interface with real HTTP:

**Constructor:** Takes decrypted `PaycorConfig` for a specific org.

**`fetchEmployees(legalEntityId)`:**
1. Calls `GET /v1/legalentities/{legalEntityId}/employees?include=All`
2. Sends headers: `Ocp-Apim-Subscription-Key` + `Authorization: Bearer`
3. Auto-paginates via `continuationToken` (200 records/page)
4. Flattens Paycor's nested response into `PaycorEmployee[]`:
   ```
   records[].id                              → paycorEmployeeId
   records[].firstName + lastName            → name (combined)
   records[].email.emailAddress              → email
   records[].statusData.status               → status
   records[].positionData.jobTitle           → jobTitle
   records[].positionData.manager.id         → managerId
   records[].employmentDateData.hireDate     → hireDate
   records[].employmentDateData.terminationDate → terminationDate
   ```

**Token refresh:**
- Before each call, checks `tokenExpiresAt`
- If expired: POST to `/v1/authenticationsupport/retrieveAccessTokenWithRefreshToken`
  body: `{ refresh_token, client_id, client_secret }`
- Stores new tokens back to org's `paycorConfig` in DB (encrypted)

**Error handling:**
- 401 → try token refresh, retry once
- 429 → respect `Retry-After` header, wait and retry
- 500 → log, don't retry (Paycor says don't retry POST on 500)

**Health check:** `GET /api/Health/ping` — used by "Test Connection"

**Base URL:** Derived from `config.environment`:
- `sandbox` → `https://apis-sandbox.paycor.com`
- `production` → `https://apis.paycor.com`

**Tests:** Mock HTTP responses (msw or manual fetch mock), NOT real API
calls. Test pagination assembly, response flattening, token refresh,
error handling.

### Pass 3 — Settings UI (~3 hrs)

New route: `/dashboard/settings/integrations`

**Components:**
- `src/app/app/dashboard/settings/integrations/page.tsx` — server page
- `src/app/app/dashboard/settings/integrations/paycor-connect-form.tsx`
  — client form (credential inputs + test/connect buttons)
- `src/app/app/dashboard/settings/integrations/paycor-connected-card.tsx`
  — server component showing connection status + disconnect

**Server actions** (`src/app/actions/paycor-config.ts`):
- `connectPaycorAction(formData)` — validates inputs, encrypts secrets
  via `src/lib/crypto.ts`, runs app activation endpoint to get initial
  tokens, saves `paycorConfig` to org. Logs `paycor.connected`.
- `testPaycorConnectionAction(formData)` — calls health check + fetches
  legal entity name. Returns success/failure without saving.
- `disconnectPaycorAction()` — nulls `paycorConfig`, logs
  `paycor.disconnected`.

**Navigation:** Add "Settings" link to the profile dropdown (or nav bar)
for HR Admin. The settings page has an "Integrations" tab with the
Paycor card.

**UX flow:**
1. HR Admin navigates to Settings → Integrations
2. Sees "Paycor — Not connected" card with form fields
3. Enters: Legal Entity ID, Environment, APIM Key, Client ID, Client Secret
4. Clicks "Test Connection" → green checkmark + legal entity name, or red error
5. Clicks "Connect" → credentials encrypted + saved, page refreshes to connected state
6. Connected state shows: legal entity, environment, last sync, disconnect button

**Visibility gate:** Only HR Admin role. Only show Paycor card for orgs
where it makes sense (Enterprise tier or RI's custom plan). For v1,
show it for ALL orgs since any org could theoretically connect to Paycor.

### Pass 4 — Wire real client into sync cron (~1 hr)

Update `src/app/api/cron/paycor-sync/route.ts`:

1. Replace `getProvider()` → `new MockPaycorProvider()` with:
   ```ts
   const config = decryptPaycorConfig(org.paycorConfig);
   const client = new PaycorApiClient(config);
   ```
2. After sync: write `lastSyncAt`, `lastSyncStatus`, `lastSyncChanges`
   back to org's `paycorConfig`
3. Store `paycorEmployeeId` on `org_memberships` during hire/match
4. Update `diffRoster()` to prefer `paycorEmployeeId` matching with
   email fallback

### Pass 5 — Bug fixes (~1 hr)

Three bugs from the Phase 2 audit:

1. **Retry off-by-one** (`sftp-delivery.ts`): Change `lte` to `lt` in
   the pending query so jobs get 3 attempts, not 4.

2. **Role counter missing** (`paycor-sync/route.ts`): Add `role_changed`
   to the switch statement. Currently latent (diffRoster never emits it)
   but needs to be there for Phase 3.

3. **Global role update** (`apply-change.ts`): `applyRoleChanged` updates
   `users.role` which is global. Should only update `orgMemberships.role`.
   Remove the `users` table UPDATE, keep only the `orgMemberships` UPDATE.

## Dependency order

```
Pass 1 (expand config + migration)
  ├── Pass 2 (API client) — needs credential type
  │     └── Pass 4 (wire into cron) — needs real client
  └── Pass 3 (Settings UI) — needs credential type
Pass 5 (bug fixes) — independent, do anytime
```

Passes 1, 5 can be done first (small). Then 2 and 3 in parallel.
Then 4 to wire it together.

## Estimated effort

| Pass | Effort |
|---|---|
| 1 — Config expansion + migration | ~1 hr |
| 2 — API client | ~3 hrs |
| 3 — Settings UI | ~3 hrs |
| 4 — Wire into cron | ~1 hr |
| 5 — Bug fixes | ~1 hr |
| **Total** | **~9 hrs (1-2 sessions)** |

## What this plan does NOT cover

- Real SFTP transport (blocked on Paycor SFTP credentials)
- AI transcription (Wave 3, separate workstream)
- JC standards cron (blocked on Tricia)
- Performance review summaries (depends on SFTP being live)
- Dev/prod DB split (separate ops task)

## Test accounts

| Role | Email | Password | Org |
|---|---|---|---|
| HR Admin | bree.martinez@audithalo.test | Iu029IB-uuG4dsS137xaa3Dg | Recovery Innovations Test |
| Supervisor | sarah.chen@audithalo.test | 8Bm6SAD1xVAOfDFiC9Es5RXm | Recovery Innovations Test |
| Supervisee | jordan.williams@audithalo.test | hgBUibau3qcykl4LuISWm_Gn | Recovery Innovations Test |

## Handoff message for new session

```
Starting AuditHalo Wave 2 Phase 3 — Settings UI + Paycor API client.

AGENTS.md and memory auto-load. Read these docs in order:
1. docs/strategy/15-settings-ui-and-api-client.md (THIS SESSION'S PLAN)
2. docs/strategy/14-wave2-phase2-scaffolding.md (what's already built)
3. docs/strategy/13-paycor-integration.md (Wave 2 master spec)
4. docs/HANDOFF.md (current state)

Paycor swagger specs at docs/paycor/paycor-public-api-v1.json (1.4MB).

Repo: C:\code\audithalo, branch main.
Working tree clean. 441 tests passing. Build green.

What's done (don't redo):
- Phase 2 scaffolding: PaycorChange types, applyPaycorChange(),
  diffRoster(), delivery queue, cron endpoints, mock providers, 56 tests
- 2E RI Clinical Supervision Form PDF (complete)
- Migration 0030 + 0031 applied

What's next (5 passes in this plan):
1. Expand PaycorConfig type + add paycor_employee_id (migration 0032)
2. Real Paycor API client (HTTP calls, pagination, token refresh)
3. Settings UI (/dashboard/settings/integrations — connect form)
4. Wire real client into sync cron
5. Fix 3 bugs (retry off-by-one, role counter, global role update)

IMPORTANT: Before implementing each pass, explain how it affects
the app from a user's perspective. The plan doc has a "Side effects"
table — use it as your checklist.

Start with Pass 1 (config expansion). Show the migration SQL before
applying.
```
