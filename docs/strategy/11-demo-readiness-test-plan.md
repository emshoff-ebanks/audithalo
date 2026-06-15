# Demo-readiness hostile test plan

**Drafted 2026-06-15 for a 2026-06-16 10:00 demo with the customer that
commissioned the build.**

The goal of this plan is not "do the tests pass" — it is "what would
break, who would misuse it, and what would embarrass us live in front
of Damon and the customer." Every item below is written so it can be
checked off. Anything that can't be checked off by demo time goes on
the "accepted risk" list at the bottom so we know what NOT to touch
during the live walkthrough.

## Objectives

1. **No 500s or error boundaries** on any route a demo viewer might
   click through. Tested across all four real roles.
2. **No cross-org / cross-role data leakage** under any URL the user
   might paste or under any form they might submit with the wrong
   cookies.
3. **No misleading state** — every counter on every dashboard
   reflects underlying truth. The Damon supervisee "0 vs ?" reading we
   chased today must not recur for a different supervisee.
4. **No silent action failures** — every button either does what it
   says or surfaces an error. No more "I clicked and nothing
   happened" reports.
5. **Mobile renders cleanly** on iPhone-sized viewports for the four
   surfaces the customer is likely to look at on phone (dashboard,
   sign screen, roster, calendar).

## Test environment

- **Target host:** `https://app.audithalo.com` (production). Demo will
  be live against prod data, so prod is what we test.
- **Test accounts already seeded:**
  - HR Admin: `damon-test-hr@audithalo.test` (pw stored in 1Password)
  - Supervisor: `damon-test-supervisor@audithalo.test`
  - Supervisee: `damon-test-supervisee@audithalo.test`
  - All three are in the "Damon Test Org" — clean fence.
- **Browser matrix:**
  - Chrome 149 desktop (primary demo browser)
  - Safari 18 iPhone 15 viewport (mobile sanity)
  - Firefox 130 desktop (a single smoke run, in case Damon shares his
    screen and it's not Chrome)

## Part 1 — Four-Horsemen review

Per `docs/developers.md`, dispatch four parallel review subagents
against the surfaces below. **One agent per horseman, all four
running in parallel.** Each one is briefed with: scope, what to look
for, and how to format findings.

### Scope of the review

Everything that has shipped since the morning of 2026-06-12 — the
entire active feature set the customer will see:

- Rules admin (cycles 1–7): override editor, custom-rule wizard,
  deactivate flow, history page, version-drift banner, "this rule has
  an override" badges
- Nav restructure: top nav, profile dropdown, role gating, mobile
  collapse, bell outside-click
- Roster supervisor filter
- Calendar + scheduling: 12-hour datetime picker, schedule form,
  reschedule form, today's schedule widget, recurring series
- Sign flow: post-meeting sign screen, "this didn't happen" affordance,
  sign-reminder cron + dedupe
- Supervisee dashboard: this-week widget, status cards click-throughs
- Bell notifications: outside click close, all 13 NotificationKinds
- HRIS CSV import (Phase 1)
- Evidence package generation + verify URL

### Horseman 1 — Correctness

**Brief:** "You are reviewing the codebase for behavioral correctness.
Find anything that does not do what its name, docstring, or UI label
promises. Pay particular attention to:
- Filters that exclude rows the user expects to see (re-do the
  `pendingSignaturesForUser` audit, look for similar end-time / status
  conflations across all dashboard surfaces)
- Race conditions: two co-admins editing one override, supervisor
  signing while sign-reminder cron is firing, supervisee signing while
  supervisor cancels
- State machines: every place `scheduledStatus` is set, every place
  it's read — is the path consistent? Is there any transition we
  forgot (e.g. canceling a no-show, signing a canceled session, marking
  a signed session as no-show)?
- Cron dedupe: can `sign_reminder_sent_at` ever be reset by anything
  besides reschedule? Should it be reset by anything else?
- Rule override propagation: every `STRUCTURED_TO_CHECK_PARAM` entry —
  does the evaluator's check actually read that param key?

Report findings as a markdown list, each item: file:line, the bug, the
worst-case user impact, a one-line fix sketch. Skip code style. Skip
nitpicks. Demo is in 18 hours."

### Horseman 2 — Security

**Brief:** "You are reviewing the codebase for security holes.
- Authz: every server action, every API route. Does the action verify
  the actor's org membership AND role AND that the resource belongs to
  the org? Look for places that check ONE of the three.
- IDOR: any URL that takes a UUID — supervisee id, override id, session
  id, package id, audit log entry. Can a member of org A reach org B's
  resource by guessing or scraping ids?
- Direct action invocation: server actions called from client `<form>`
  or `useTransition`. Could a hostile client invoke them with arbitrary
  args (curl with their own cookie)?
- CSRF: NextAuth-based session cookies + server actions — confirm Next
  16's built-in CSRF guards are actually in play, not bypassed by
  `dynamic = "force-dynamic"` or similar.
- The new sign-reminder cron endpoint: `Authorization: Bearer
  ${CRON_SECRET}` is the only check. Is the token comparison
  timing-safe? Is there any other way to trigger this without the
  secret?
- The /api/client-error endpoint — wait, we deleted that. Confirm it
  isn't still deployed somewhere.
- PII in logs: scan recent edits — anything new console.log'ing user
  emails, names, signatures, attestation values?
- The new 12-hour picker — could the composed `YYYY-MM-DDTHH:mm` value
  ever be crafted to inject something on the server side?
- HRIS CSV import: row limit, parser hardening, executable-content
  guard (CSV injection via `=cmd()`).

Report findings as: file:line, severity (Critical/High/Medium/Low),
attack scenario, proposed mitigation. Critical means 'do not demo
without fixing.'"

### Horseman 3 — Performance

**Brief:** "You are reviewing the codebase for performance hazards.
- N+1 queries: every server-component render. Look at the supervisee
  dashboard, roster page, executive dashboard, calendar page — are any
  of them doing per-row fetches in a loop?
- The new this-week widget does ONE batch query for sessions + one for
  logger names. Confirm.
- `getOrgRosterWithCompliance` now runs four batch queries (was
  three) — confirm the fourth (org_rule_overrides) is properly indexed
  and doesn't cliff at 100 supervisees.
- The sign-reminder cron query has a partial index from migration
  0028 — confirm Postgres actually uses it (`EXPLAIN ANALYZE` on a
  realistic shape).
- Client bundles: did the nav restructure pull lucide-react icons we
  weren't using before? Did the new profile-dropdown component code-
  split, or is it landing in the layout bundle?
- The supervisor 'today' widget + new supervisee 'this week' widget
  both compute their own date math — confirm neither triggers a
  hydration mismatch (we just fixed React #185, don't reintroduce it).

Report findings as: file:line, latency or memory or bundle impact,
worst-case at expected scale (100 supervisees, 1000 session_events,
10000 audit entries), suggested fix."

### Horseman 4 — UX

**Brief:** "You are reviewing the UX hostilely. The customer is a
non-technical mental-health supervisor seeing the app for the first
time. Find everything that would confuse, mislead, or look broken to
them.
- Empty states: every list, every counter, every widget. Does an
  account with zero of X look intentional or look broken?
- Loading states: does anything flash 'undefined' or '0' before the
  data lands?
- Mobile: iPhone 15 viewport. Do the new top nav, this-week grid,
  profile dropdown, sign screen, and 12-hour picker all render and
  function without horizontal scroll or unreachable buttons?
- Click targets: does every counter / badge / status that LOOKS
  clickable actually navigate somewhere, and conversely, does anything
  navigate that the user didn't expect to be clickable?
- Color semantics: are status colors used consistently
  (warning = pending action, risk = bad, success = good)? After today's
  avatar palette fix, are there other places where the bright royal
  blue still bleeds through?
- Copy: does any label use developer jargon ('scheduledStatus',
  'no_show', 'evaluator', 'cron')? Customer should never see that
  language.
- Error states: if an action fails (Resend down, OAuth token expired),
  does the user get a clear next step or a stack trace?
- The new 'This didn't happen' button — is the modal copy clear about
  which choice has which consequence?
- Onboarding for a fresh org: does the empty-org HR Admin land on a
  dashboard with a clear path to invite their team, or does it look
  like a dead page?

Report findings as: surface (URL + viewport), the confusion, severity
(Demo-blocker / Polish / Nitpick), suggested copy or layout change.
Skip anything that requires a redesign — we ship demo-blocker fixes
only."

### After the four agents return

Merge findings into a single triage table sorted by severity. Fix
every Critical / Demo-blocker before sleep tonight. Defer everything
else to a "post-demo polish" issue list.

---

## Part 2 — Playwright E2E expansion

Existing specs in `e2e/` cover marketing pages, an unauthed healthcheck,
and a handful of RBAC route checks. They do NOT cover the demo-critical
flows. Adding the specs below before demo morning.

### 2a. Smoke run (`e2e/demo-smoke/`)

Single spec that walks each role through the demo happy path.
**Failure here = do not demo.** Runs against prod.

1. **HR Admin demo path**
   - Log in as `damon-test-hr@audithalo.test`
   - Land on `/dashboard` — no error boundary, "Welcome back, Damon"
     greeting visible, status counters render
   - Click "Manage roster" in nav — `/dashboard/roster` 200
   - Click into a supervisee — `/dashboard/roster/<id>` 200, rule
     summary card renders
   - Click "Team" in nav — `/dashboard/team` 200, "Customize state
     rules" button visible
   - Click "Calendar" in nav — `/dashboard/calendar` 200, week view
     renders
   - Open profile dropdown — Account / Audit log / State rules / Sign
     out all visible
   - Click "Audit log" — `/dashboard/audit-log` 200, at least one row
   - Click "State rules" — `/dashboard/team/rules` 200, canonical
     rules section visible
   - Click bell — drawer opens, click outside — drawer closes
2. **Supervisor demo path**
   - Log in as `damon-test-supervisor@audithalo.test`
   - `/dashboard` 200, today's schedule widget either renders sessions
     or hides cleanly
   - "Manage roster" + "Calendar" visible in nav; "Team" + "Audit log"
     + "State rules" NOT visible
   - Click into damon-test-supervisee — `/dashboard/roster/<id>` 200,
     no gap renders crash, "Change rule" button visible
3. **Supervisee demo path**
   - Log in as `damon-test-supervisee@audithalo.test`
   - `/dashboard` 200, "Needs your signature" section either renders
     or hides cleanly (we just fixed the filter — confirm)
   - "This week" widget renders if there are scheduled sessions
   - Click Status card — lands on `/dashboard/roster/<own id>#gaps`
   - Click into a future session card — `/sign/<id>` 200 with the
     pre-meeting view

### 2b. Hostile RBAC (`e2e/hostile/rbac.spec.ts`)

Tests that a low-privilege role gets blocked from a high-privilege
URL by either redirect or 403, NOT by a 500 or an info leak.

1. Supervisee → `/dashboard/team/rules` (HR Admin only) — expects
   redirect, NOT a render that shows partial data.
2. Supervisee → `/dashboard/team` — same.
3. Supervisee → `/dashboard/audit-log` — same.
4. Supervisor → `/dashboard/team/rules` — redirect.
5. Supervisor → `/dashboard/audit-log` — should NOT be HR-Admin-only
   reachable but confirm what we shipped.
6. Supervisor → `/dashboard/roster/<some other supervisor's
   supervisee>` — verify they get redirected or 404, not 200 with
   another supervisor's data.
7. Logged-out → every authenticated route — expects redirect to
   `/login`, no flash of dashboard content before the redirect.

### 2c. Cross-org isolation (`e2e/hostile/cross-org.spec.ts`)

Damon Test Org has at least one supervisee. Seed (or assume) a second
org with another supervisee. Test that the Damon HR Admin cannot
reach the other org's resources by URL.

1. Damon HR Admin → `/dashboard/roster/<otherOrgSuperviseeId>` — 404
   or redirect, NOT a render of the other supervisee.
2. Damon HR Admin → `/dashboard/team/rules/<otherOrgOverrideId>` —
   same.
3. Damon HR Admin → POSTs `assignRuleAction` with a `superviseeId`
   from the other org via DevTools — server action returns
   `ok: false`, no DB write.
4. Damon HR Admin → POSTs `deactivateOverrideAction` with an
   `overrideId` from the other org — same.

### 2d. Adversarial form inputs (`e2e/hostile/inputs.spec.ts`)

For every form the customer might play with during the demo, throw bad
input at it and confirm graceful handling.

1. **Invite supervisee form** — submit with:
   - Empty email
   - Malformed email (`foo`, `foo@`, `@bar.com`)
   - Email with SQL/HTML injection (`'); DROP TABLE users;--`,
     `<script>alert(1)</script>`)
   - Email already in another org
   - Email already an active supervisee in this org (idempotency)
2. **Schedule session form (new 12h picker)** —
   - Date in the past, time 11:59 PM → server should reject
   - Date = today, time = past today — same
   - Hour rapidly toggled 12 AM ↔ 12 PM in the same render — confirm
     the hidden output value is right
   - Duration = 0, negative, 9999 — server rejects
   - Submit twice in <1 second (double-click) — only ONE session
     created (idempotency check)
3. **Override editor** —
   - Set `total_practice_hours_required` to 0 — server rejects (zod
     `positive()`)
   - Set to `-5`, `1e308`, NaN string — server rejects
   - Try to upgrade a severity (warning → blocker) — server rejects
   - Submit two concurrent saves from two browser tabs with same
     `expectedUpdatedAt` — second one should return `stale_row`
     conflict, NOT both succeed.
4. **Sign session form** —
   - Submit with empty attestation — rejected
   - Re-submit the same signature twice — second one is a no-op (or
     gracefully rejected) — should not produce two signature rows in
     the signatures array
5. **Custom rule wizard** —
   - Pick a jurisdiction + license that already has a canonical rule
     (NC + LCMHCA) — wizard should redirect to override editor with a
     toast, NOT create a duplicate custom rule
   - Submit citation_url = "not a url" — rejected
   - Submit 0 checks — rejected (min 1 required)

### 2e. Race conditions (`e2e/hostile/race.spec.ts`)

These are flaky by definition but worth running once each before
demo.

1. Two HR Admin tabs editing the same override. Tab A saves at T,
   Tab B saves at T+100ms with the older `expectedUpdatedAt`. Tab B
   gets the stale_row error.
2. Supervisor signs a session while the sign-reminder cron fires for
   it (call the cron endpoint manually with the secret immediately
   after signing). No double notification; cron's `signedAt IS NULL`
   filter excludes the row.
3. Reschedule + sign race — supervisor reschedules to a new time, then
   another tab signs the session. Server should reject the sign if
   the row state is inconsistent.
4. Cancel + sign race — supervisor cancels in tab A, supervisee tries
   to sign in tab B. Sign should fail with a clear error.

### 2f. Mobile rendering (`e2e/hostile/mobile.spec.ts`)

Runs the smoke paths but with Playwright's `iPhone 15` device emulation
configured. Visual regression isn't worth wiring up — just verify
every page returns 200 with no JS console errors, no overflow scroll,
and the primary button on each page is reachable without horizontal
scrolling.

### 2g. Existing tests that must stay green

Run the full existing `e2e/rbac/`, `e2e/marketing/`, and `e2e/mutations/`
suites before bed. Any new red is a demo blocker until investigated.

---

## Part 3 — Adversarial probes (manual, this evening)

Some misuse is too varied for Playwright to enumerate. Manual probes
specifically targeting things humans do that automation wouldn't.

1. **Copy-paste of a session URL to a teammate.** A supervisor copies
   `/sign/<id>` and sends it to another supervisor who isn't on this
   supervisee. Does the second supervisor get a friendly "you can't
   view this" or a 500?
2. **Browser back button after sign.** Sign a session. Hit back. Does
   the form re-render and let me sign again? Or does the page show
   the sealed state?
3. **Browser back button after override save.** Save an override. Hit
   back. Does the form let me re-save with the same
   `expectedUpdatedAt` and produce a stale_row error?
4. **Refresh during action submit.** Click "Sign," instantly F5. Does
   the action complete server-side, or do we end up with a half-
   written sig array?
5. **Network throttle to 3G during sign.** Slow 3G. Click sign. Does
   the UI block double-submit (button disabled)?
6. **Time zone spoof.** Set OS to Asia/Tokyo. Schedule a session for
   "tomorrow 10 AM." Switch OS to America/Los_Angeles. Open the
   calendar — does the session show at the correct UTC instant, or
   does it shift?
7. **Old browser tab.** Leave a logged-in tab open overnight. Come
   back at demo time. Click around — does the tab silently produce
   401s because the JWT expired? Or does the bell poll surface a
   friendly "you've been logged out, refresh"?
8. **Concurrent log-in.** Sign in to the same supervisor account on
   two devices. Sign a session on device A. Does device B's bell
   update on its next poll, or does it look stale?

---

## Part 4 — Demo-morning smoke checklist

Run THIS exact list at 9:00 AM, ten minutes before screen-share starts.

- [ ] `git status -sb` — branch is on `main`, no uncommitted changes
- [ ] `git log --oneline -5` — most recent commit message reads sane
- [ ] `npx vercel ls audithalo --prod` — last prod deploy is Ready
- [ ] Open `https://app.audithalo.com/login` in a fresh incognito
- [ ] Log in as HR Admin → land on dashboard, no error
- [ ] Open bell → at least one notification renders OR empty state
- [ ] Open profile dropdown → all four entries
- [ ] Click "State rules" → at least one canonical rule listed
- [ ] Click into a supervisee from the roster → page renders,
      progress bars + status are non-NaN
- [ ] Sign out → return to /login cleanly
- [ ] Repeat as supervisor account
- [ ] Repeat as supervisee account (the test data set should still
      include one signable session — if all 4 May/June sessions are
      signed and no new ones have happened, the dashboard will
      correctly show 0 — this is fine, just expected)
- [ ] GitHub Actions → Sign-reminders cron — last run is green (if
      red, fix BEFORE demo even if it means temporarily disabling the
      workflow)
- [ ] Vercel logs `--since 1h` — no 500s or unhandled errors

If any of these fail, message the customer to push the demo by 30
minutes and triage. Do NOT walk into the demo with anything red.

---

## Part 5 — Accepted risks (do not demo around these)

Known limits or rough edges. We will NOT bring these up during the
demo, and the customer is unlikely to find them, but if they do, the
honest answer is "post-launch polish."

1. **Sentry not wired in prod.** All four Sentry env vars are empty
   strings in Vercel. We can't see client-side errors in real time. If
   a demo viewer hits one, we'll see it in their browser console only.
2. **Old auto-no-show notifications still in the bell** for older
   accounts. New flow doesn't create them, but historical rows stay.
3. **Stripe is live but on test mode.** Don't click "Subscribe" during
   the demo.
4. **Resend free tier rate limit.** If the demo triggers 30+
   notifications in 5 minutes the email side will silently 429. The
   in-app bell still works.
5. **HRIS Phase 2 / Phase 3 (Merge.dev pull + webhook) not built.**
   Phase 1 CSV import is live. Honest framing: "live today; the
   continuous sync is the next thing we're scoping with you."
6. **The schedule modal on calendar empty-slot click** still uses the
   old datetime-local through a URL `?start=` param. The
   12-hour picker lands on the supervisee form. Not a demo blocker;
   nobody clicks empty slots during a demo.

---

## Sign-off

- [ ] Four-Horsemen review complete, all Critical findings shipped
- [ ] Playwright demo-smoke spec green against prod
- [ ] Hostile RBAC + cross-org + inputs specs green
- [ ] Mobile smoke green on iPhone 15 viewport
- [ ] Adversarial manual probes done, no findings worse than "Polish"
- [ ] 9:00 AM smoke checklist ready to run

When all six are ticked, we walk into the 10 AM demo with confidence.
