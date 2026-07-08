# Paycor OAuth Redirect — Fix Connect Flow Before July 15 Call

> Written 2026-07-08. Must ship before the July 15 call with Chris.

## What's wrong today

The Settings > Integrations > Paycor page has a form where the HR Admin
manually pastes 6 credentials (Legal Entity ID, APIM key, Client ID,
Client Secret, Refresh Token, Environment). This is wrong:

1. **The refresh token shouldn't be pasted.** Paycor uses standard
   OAuth 2.0 authorization code flow — the tokens come from a redirect,
   not from AppCreator.
2. **It's unprofessional.** Our Google Calendar and Microsoft Teams
   connections use proper OAuth redirects. Paycor should too.
3. **Chris can't easily give us a refresh token.** The Paycor developer
   portal doesn't surface refresh tokens for copy-paste — they're
   obtained through the OAuth flow.

## What the correct flow looks like

**Paycor OAuth endpoints** (confirmed from [Rollout integration guide](https://rollout.com/integration-guides/paycor/how-to-build-a-public-paycor-integration-building-the-auth-flow)):

| Endpoint | URL |
|---|---|
| Authorization | `https://secure.paycor.com/connect/authorize` |
| Token exchange | `https://secure.paycor.com/connect/token` |
| Sandbox authorization | `https://secure-sandbox.paycor.com/connect/authorize` |
| Sandbox token | `https://secure-sandbox.paycor.com/connect/token` |

**Flow:**
1. HR Admin clicks "Connect to Paycor" on the Settings page
2. AuditHalo redirects to `https://secure.paycor.com/connect/authorize`
   with `response_type=code`, `client_id`, `redirect_uri`, `scope`
3. Paycor shows their login/consent screen
4. User approves → Paycor redirects back to AuditHalo's callback URL
   with an authorization `code`
5. AuditHalo exchanges the code for `access_token` + `refresh_token`
   via POST to `https://secure.paycor.com/connect/token`
6. Tokens are encrypted and stored in `organizations.paycorConfig`
7. Connection is live

**What the user still needs to provide manually:**
- **APIM Subscription Key** — this IS from the developer portal (it's
  an API management key, not OAuth). Pasted in a form field.
- **Legal Entity ID** — from Paycor company settings.
- **Environment** — sandbox vs production toggle.

The Client ID and Client Secret are stored in AuditHalo's **env vars**
(not per-org) since AuditHalo is one registered application. Each org
gets their own tokens through the OAuth flow, but they all use the
same app registration.

**Wait — this changes the architecture.** Currently each org stores its
own Client ID + Secret. But in the standard OAuth pattern, the app
(AuditHalo) has ONE Client ID + Secret registered with Paycor, and
each org authorizes AuditHalo via the OAuth redirect. The per-org
data is just: Legal Entity ID, APIM key, access token, refresh token.

## What the user sees

### Step 1: Settings page (before connect)

```
Paycor Integration                    [Not connected]

Connect your Paycor account to sync your employee roster
and deliver supervision forms automatically.

Legal Entity ID  [________]
APIM Key         [________]
Environment      [Production ▾]

[Connect to Paycor →]
```

### Step 2: Paycor login (redirect)

User sees Paycor's own login page. They log in with their Paycor
admin credentials. Paycor asks "Allow AuditHalo to access employee
data?" — they click Approve.

### Step 3: Back in AuditHalo (after redirect)

```
Paycor Integration                    [Connected ✓]

Legal Entity: 500123
Environment: Production
Last sync: Never (sync runs daily at 6 PM ET)
Connected: just now

[Sync Now]  [Disconnect]
```

## Env vars needed (AuditHalo-wide, not per-org)

```
PAYCOR_CLIENT_ID=abc123          # from AppCreator
PAYCOR_CLIENT_SECRET=xyz789      # from AppCreator
PAYCOR_REDIRECT_URI=https://app.audithalo.com/api/paycor/callback
```

These are set in Vercel env vars, NOT per-org. RI's specific data
(Legal Entity ID, APIM key, tokens) is per-org in `paycorConfig`.

## Implementation passes

### Pass 1 — OAuth config + callback route (~2 hrs)

**New env vars:** `PAYCOR_CLIENT_ID`, `PAYCOR_CLIENT_SECRET`, `PAYCOR_REDIRECT_URI`

**New route:** `src/app/api/paycor/callback/route.ts`
- Receives the authorization code from Paycor's redirect
- Exchanges code for tokens via POST to `/connect/token`
- Encrypts and saves tokens to org's `paycorConfig`
- Redirects back to `/dashboard/settings/integrations`

**OAuth state management:** Reuse the pattern from
`src/lib/calendar/oauth-state.ts` — encrypt the orgId + userId into
the state parameter to prevent CSRF and identify which org is connecting.

### Pass 2 — Update Settings UI (~1 hr)

Replace the 6-field form with:
- Legal Entity ID input
- APIM Subscription Key input (password field)
- Environment selector (sandbox/production)
- "Connect to Paycor →" button (redirects to Paycor OAuth)

Remove: Client ID, Client Secret, Refresh Token fields (these are
now handled automatically).

### Pass 3 — Update PaycorConfig type (~30 min)

Remove `oauthClientId` and `oauthClientSecret` from per-org config
(they're now in env vars). Keep:
- `legalEntityId`
- `environment`
- `apimSubscriptionKey` (encrypted, per-org)
- `oauthAccessToken` (encrypted, from OAuth flow)
- `oauthRefreshToken` (encrypted, from OAuth flow)
- `tokenExpiresAt`
- Connection metadata

### Pass 4 — Update token refresh in API client (~30 min)

The `PaycorApiClient.refreshToken()` currently reads client_id and
client_secret from the per-org config. Update it to read from env vars.

Token refresh endpoint: POST `https://secure.paycor.com/connect/token`
Body: `grant_type=refresh_token&refresh_token=X&client_id=ENV&client_secret=ENV`

### Pass 5 — Enable and verify the sync cron (~1 hr)

**Vercel Cron vs GitHub Actions:**
Since you now have Vercel Pro, Vercel Cron is the better option:
- No external webhook needed
- Runs on the same infrastructure as the app
- Easier to monitor via Vercel dashboard
- Pro plan supports cron jobs

Add to `vercel.json` (or `vercel.ts`):
```json
{
  "crons": [
    {
      "path": "/api/cron/paycor-sync",
      "schedule": "0 22 * * *"
    }
  ]
}
```
(22:00 UTC = 6:00 PM ET)

The cron endpoint already has CRON_SECRET auth. Vercel Cron sends
this header automatically.

### Pass 6 — Test end-to-end (~1 hr)

1. Set PAYCOR_CLIENT_ID + SECRET in .env.local (from Chris or sandbox)
2. Click "Connect to Paycor" → redirected to Paycor login
3. Approve → redirected back → "Connected ✓"
4. Click "Sync Now" → roster pulled from Paycor
5. Verify employees appear on the roster page

## What to do BEFORE the call with Chris

1. **Register AuditHalo as an app in Paycor's developer portal**
   — Chris does this and gives you the Client ID + Client Secret
2. **Set env vars:** `PAYCOR_CLIENT_ID`, `PAYCOR_CLIENT_SECRET`,
   `PAYCOR_REDIRECT_URI` in Vercel + .env.local
3. **Ship all 6 passes** so the OAuth flow works
4. **Test against sandbox** if possible (Chris may be able to give
   sandbox access too)

## On the call itself

1. Chris shares the APIM Subscription Key + Legal Entity ID
2. Caleb opens AuditHalo Settings > Integrations
3. Enters Legal Entity ID + APIM Key
4. Clicks "Connect to Paycor"
5. Redirected to Paycor — Chris helps Caleb log in with the right
   admin account
6. Approves → redirected back → Connected
7. Click "Sync Now" → see employees populate
8. Everyone sees it working live

## Effort estimate

| Pass | Effort |
|---|---|
| 1 — OAuth config + callback | ~2 hrs |
| 2 — Update Settings UI | ~1 hr |
| 3 — Update PaycorConfig type | ~30 min |
| 4 — Update token refresh | ~30 min |
| 5 — Enable sync cron | ~1 hr |
| 6 — Test E2E | ~1 hr |
| **Total** | **~6 hrs (1 session)** |

## References

- [Rollout: Paycor auth flow guide](https://rollout.com/integration-guides/paycor/how-to-build-a-public-paycor-integration-building-the-auth-flow)
- Token endpoint: `https://secure.paycor.com/connect/token`
- Auth endpoint: `https://secure.paycor.com/connect/authorize`
- Existing calendar OAuth pattern: `src/lib/calendar/oauth-handlers.ts`
