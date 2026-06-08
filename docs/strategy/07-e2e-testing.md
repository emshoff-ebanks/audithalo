# E2E testing — Playwright suite

_Drafted 2026-06-08. Companion to `04-enterprise-rbac.md` (the 6 RBAC smoke flows that motivated this). This doc codifies the discipline for browser-driven tests so future agents don't silently compromise it (e.g., downgrading to API-only when auth automation breaks, leaking the DB key into browser context, polluting prod with test data)._

## Why E2E exists in this project

Vitest already covers the rule engine, billing math, audit-log helpers, HRIS parser, and authz helpers (267 passing as of `release/enterprise` merge). That's 100% of the pure-function surface that benefits from unit tests. What it doesn't prove:

1. **UI wiring** — does the "Reassign" button actually call `reassignSupervisorAction`? Does the Insurance tab pass the right financial class? Does the right server action fire with the right payload?
2. **Role guards** — does the Executive role actually get redirected at the route level, not just hidden in the nav?
3. **End-to-end state transitions** — when HR Admin clicks "Promote to Enterprise", does the org tier flip + the role flip + the welcome email fire + the audit log entry land?

Playwright is for proving the things that only a real browser hitting the real app can prove.

## Principles (carry forward from the charge-master playbook)

1. **Test the layer Vitest can't.** No re-testing of pure functions. Tests must exercise the UI → server action → DB → response loop.
2. **Network assertions on every mutation.** Intercept the server action call; assert the payload shape; assert forbidden patterns never appear.
3. **DB verifier alongside UI tests.** After a UI action, query the DB to prove the right rows changed. Verifier is **Node-side only** — never imported into browser specs.
4. **Auth setup once, not per test.** `e2e/auth.setup.ts` logs in as each role and saves storage state. Each spec loads the right state instead of re-logging in.
5. **Real demo accounts via env vars, never created in tests.** Test users live in a staging DB. Their credentials live in CI secrets. Tests fail loudly if `E2E_HR_ADMIN_EMAIL` is missing.
6. **Fail loudly, never silently downgrade.** If auth automation breaks, halt the suite with "missing selector X, env var Y." Don't fall back to API-only to make CI green.
7. **Forbidden-pattern grep gate.** A shell script greps the codebase for patterns that must never appear (e.g., `medipyxis` in commits, direct `client.query` in `src/app/app/`, hardcoded prod URLs in code). Exact-match regexes only.
8. **Stop conditions written into the plan.** "Halt if auth automation can't complete." "Halt if selectors require destructive UI refactoring." "Halt if `DATABASE_URL` would need to enter browser code."

## Required test users

Four accounts, one per role, all on the same staging org once Phase 6 lands. Until then, on prod (with careful cleanup).

| Role | Suggested email (Gmail+alias) | Password env var |
|---|---|---|
| HR Admin | `audihalosupervisor+hr@gmail.com` | `E2E_HR_ADMIN_PASSWORD` |
| Supervisor | `audihalosupervisor+sup@gmail.com` | `E2E_SUPERVISOR_PASSWORD` |
| Supervisee | `audihalosupervisor+sve@gmail.com` | `E2E_SUPERVISEE_PASSWORD` |
| Executive | `audihalosupervisor+exec@gmail.com` | `E2E_EXECUTIVE_PASSWORD` |

Setup is automated via `scripts/seed-e2e-users.ts`. Run once:

```pwsh
npx tsx scripts/seed-e2e-users.ts
```

The script:
- Creates 4 users with `@audithalo.test` emails (IANA-reserved TLD — nothing routes to a real inbox)
- Creates 1 "E2E Test Org" already at Enterprise tier
- Inserts 4 memberships + 1 supervisor→supervisee assignment
- Marks all 4 users `email_verified_at = NOW()`
- Prints the generated credentials (passwords are bcrypt-hashed in the DB; the printed plaintext is the only copy)

Re-running the script wipes and rebuilds the org with fresh credentials.

## Where env vars live

**Not on Vercel** — the Next.js app doesn't read these. Two locations only:

1. **`.env.local`** (gitignored) — for local Playwright runs. The seed script's output gets pasted here.
2. **GitHub Actions secrets** — for CI. Add via repo Settings → Secrets and variables → Actions → New repository secret. Same names as `.env.local`. The workflow at `.github/workflows/playwright.yml` reads them via the `env:` block.

Required vars (set in both places):

- `E2E_BASE_URL` (e.g., `https://app.audithalo.com`)
- `E2E_ORG_ID` (UUID printed by the seed script)
- `E2E_HR_ADMIN_EMAIL` / `E2E_HR_ADMIN_PASSWORD`
- `E2E_SUPERVISOR_EMAIL` / `E2E_SUPERVISOR_PASSWORD`
- `E2E_SUPERVISEE_EMAIL` / `E2E_SUPERVISEE_PASSWORD`
- `E2E_EXECUTIVE_EMAIL` / `E2E_EXECUTIVE_PASSWORD`
- `DATABASE_URL` (already set for the app; reused by Node-side verifier — never enters browser context)

## Phase plan

### Phase 1 — Auth foundation (DONE, verified against prod)
- `scripts/seed-e2e-users.ts` — seeds the test org + 4 users idempotently
- `e2e/auth.setup.ts` — logs in as each role, saves storage state to `playwright/.auth/<role>.json` (gitignored)
- `playwright.config.ts` — auto-loads `.env.local`; gates `auth-setup` + `rbac` projects on `E2E_HR_ADMIN_EMAIL` presence so the healthcheck spec still runs without creds
- **Verified 2026-06-08:** `npx playwright test --project=auth-setup` — 4/4 passed in 21.6s against `https://app.audithalo.com`

### Phase 2 — DB verifier helper
- `e2e/helpers/db.ts` — Node-side `pg` queries. Functions: `getMembershipRole(userId, orgId)`, `getActiveSupervisorAssignment(superviseeId, orgId)`, `getOrgTier(orgId)`, `findAuditLogEntry({ orgId, action, afterTs })`, `cleanupSmokeRows({ prefix })`
- **Critical:** this file MUST NOT be imported from any `*.spec.ts` that runs in the browser. Specs import it via a Node-only helper that runs in `test.beforeAll` / `test.afterAll` hooks (which run in the test worker, not the browser).

### Test inventory (2026-06-08, comprehensive)

| Layer | Spec count | Coverage |
|---|---|---|
| Healthcheck (unauthed) | 1 file / 3 tests | login + register page render, marketing home |
| Auth setup | 1 file / 4 logins | HR Admin, Supervisor, Supervisee, Executive storage states |
| RBAC (authed read-only) | 8 files / ~25 tests | executive routing, role-aware headers, team access + DB invariant, dashboard by role, account page (4 roles), audit-log render gating, settings render gating, billing render gating |
| Marketing (unauthed) | 2 files / 15 tests | 10 marketing pages + 5 state landing pages |
| Mutations (with cleanup) | 1 file | invite supervisor → DB verify → delete invitation |

### Phase 3 — RBAC smoke tests (partial; 3/6 shipped 2026-06-08, verified 14/14 in 58.8s)

Shipped specs:
- `e2e/rbac/executive-routing.spec.ts` (3 tests) — `/dashboard` + `/dashboard/roster` both 302 → `/dashboard/executive` for exec role
- `e2e/rbac/role-aware-headers.spec.ts` (4 tests) — HR Admin sees "Org roster", supervisor sees "Your roster"; header badge reflects role
- `e2e/rbac/team-access.spec.ts` (3 tests, includes DB verifier) — HR Admin reaches team page; supervisee doesn't see HR-only controls; DB confirms membership role

Deferred (Phase 6 staging needed):


- `e2e/rbac/executive-routing.spec.ts` — login as exec; assert `/dashboard` 302s → `/dashboard/executive`; same for `/dashboard/roster`
- `e2e/rbac/hr-admin-team.spec.ts` — invite supervisor, invite executive (with seat-cap check), deactivate; DB verifier confirms the rows + audit log
- `e2e/rbac/supervisor-reassignment.spec.ts` — reassign; DB verifier confirms old row has `ended_at` + `transferred_from_supervisor_id`, new row exists; existing signed sessions remain attributed to original signer
- `e2e/rbac/practice-to-enterprise.spec.ts` — admin promote a test Practice org; verify org tier flip + owner role flip + welcome email
- `e2e/rbac/hris-csv-import.spec.ts` — upload CSV, intentionally bad row, fix, commit; verify invitation rows created in DB
- `e2e/rbac/audit-log-export.spec.ts` — login as HR Admin with TOTP enrolled → export succeeds; without TOTP → blocked

### Phase 4 — Network assertions (within each spec)
- For each mutation test, set up `page.waitForRequest()` or `page.on('request', ...)` to inspect the outgoing server action
- Assert correct action name and payload shape
- Assert forbidden patterns never appear (e.g., a "Change Supervisor" click should never call a `deleteAssignment` action)

### Phase 5 — Forbidden-pattern grep gate
- `ci/forbidden-patterns.sh` — runs in CI before Playwright. Greps for:
  - `medipyxis` anywhere in `src/` (commit hygiene)
  - Direct `db\.` or `client\.query` calls inside `src/app/app/**/page.tsx` or `*-form.tsx` (client components must use server actions)
  - Hardcoded `https://app.audithalo.com` in `src/` outside config/email templates (should use `process.env.APP_URL`)
- Fails CI on any hit. Exact-match regex per the lesson from the chat session: never use substring matches that false-positive.

### Phase 6 — Staging environment (unlock for safe mutation tests)
- Set up Neon branching so each Vercel preview deploy gets its own branch DB
- Vercel-Neon integration injects per-preview `DATABASE_URL`
- Update `E2E_BASE_URL` in the workflow to hit the preview URL of the current PR
- Now mutation tests can run safely — no prod pollution
- ~1 day of work

### Phase 7 — CI workflow refinement (current scaffold is bare)
- Update `.github/workflows/playwright.yml` to:
  - Run only auth project when `E2E_HR_ADMIN_EMAIL` is set; healthcheck always runs
  - Add `concurrency: e2e-${{ github.ref }}` so two runs on same branch don't collide
  - Upload trace + video on retry, not just on failure
  - Surface forbidden-pattern grep results as a separate job that runs first (fail fast)

## Stop conditions (halt the suite, don't paper over)

- Login automation can't complete (login form selectors changed, MFA prompt added, etc.) → halt with exact selector failure
- Required env vars missing in CI → halt with the missing var name
- `DATABASE_URL` would need to enter browser context to make a test work → halt; rethink the test
- A UI path is observed calling an old/deprecated server action → halt; surface the regression
- DB verifier can't safely identify test rows (no unique prefix on smoke data) → halt
- Cleanup fails to remove test rows → leave them clearly tagged, surface in test output

## What we are NOT testing with Playwright

- Pure rule engine math (vitest covers this)
- Billing seat-cap arithmetic (vitest)
- HRIS CSV parsing (vitest)
- Authz helper functions (vitest)
- Email body rendering (would need a separate visual-regression tool)
- PDF rendering (`@react-pdf/renderer` is deterministic; verify hash in vitest if needed)

## Reusable bits / inspiration

The principles in this doc are distilled from a charge-master Playwright design used on a separate healthcare-RCM project (see chat-2026-06-08). Same shape, different domain.
