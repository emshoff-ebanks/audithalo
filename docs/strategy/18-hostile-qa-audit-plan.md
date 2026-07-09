# 18 — Hostile QA Audit Plan: Is AuditHalo Ready for Client Handoff?

> **Purpose:** Unbiased, adversarial quality audit of every surface in AuditHalo.
> **Question:** Can we hand this app to Recovery Innovations (or any paying client) today? If not, exactly why not.
> **Date:** 2026-07-09
> **Stance:** Hostile. No assumptions of correctness. Every claim verified.

---

## 1. Executive Summary

AuditHalo has **267 passing Vitest tests** and **24 Playwright E2E specs**. The rules engine and authz helpers are well-tested. But the overall picture is alarming:

| Metric | Value | Verdict |
|--------|-------|---------|
| Server actions tested | 2 of 25 (8%) | **FAIL** |
| API route handlers tested | 0 of 15 (0%) | **FAIL** |
| Cron jobs tested | 0 of 7 (0%) | **FAIL** |
| Stripe webhook handler tested | No | **FAIL** |
| Component rendering tests | 2 of 19 (11%) | **FAIL** |
| Coverage reporting configured | No | **FAIL** |
| Security scanning in CI | No | **FAIL** |
| Visual regression testing | No | WARN |
| Accessibility automation (app pages) | 0 specs | WARN |
| Accessibility automation (marketing) | 1 spec (5 pages) | PASS |
| Rules engine coverage | Excellent (13 test files) | PASS |
| Authz/RBAC helper coverage | Good | PASS |
| E2E RBAC + hostile specs | Good (24 specs) | PASS |
| Evidence/crypto coverage | Good | PASS |

**Bottom line:** The app is NOT ready for client handoff. The untested server actions, API routes, and billing flows represent unacceptable risk for a compliance SaaS handling legally-significant supervision records.

---

## 2. Current State — What IS Tested (Strengths)

- **Rules engine**: 5 state rules (NC, FL, CA, NY, TX) with full evaluation, override merging, gap grouping, leave-status pausing, and diff coverage (13 test files)
- **Authz helpers**: `isManagerRole`, `canSupervise`, `canManageOrg`, sign-permissions -- exhaustive
- **Crypto**: AES-256-GCM encrypt/decrypt round-trips, SHA-256 evidence hashing, evidence canonicalization
- **PHI scanning**: Phone, SSN, email, address, credit card pattern detection with documented false negatives
- **HRIS parsing**: CSV parser, roster diff, Paycor API client, SFTP delivery filename builder
- **Billing logic**: Seat caps, AI quotas, billing banners, tier resolution from Stripe price IDs
- **Auth tokens**: Generation, hashing, TTL enforcement, revocation checks
- **TOTP**: Secret generation, OTP URI, verification, backup code consumption
- **E2E RBAC**: All 4 roles verified against route guards, hostile bypass attempts returning redirect/403
- **E2E mutations**: Invite supervisor/supervisee, cancel invitation, update org settings, sign session + seal evidence
- **E2E clinical form**: RI form visibility, auto-save persistence, PDF template branching
- **E2E hostile**: Low-priv routes return 403/redirect (never 200/500), mobile viewport smoke

---

## 3. Current State — What is NOT Tested (Critical Gaps)

### Server Actions — 23 of 25 untested (92%)

| Action | Criticality | Why It Matters |
|--------|-------------|----------------|
| `signatures.ts` | **P0** | Core product action -- sign + seal evidence |
| `billing.ts` | **P0** | Checkout, upgrade, portal -- revenue path |
| `auth.ts` | **P0** | Signup, login, logout -- gate to everything |
| `sessions.ts` | **P0** | Session CRUD -- primary data entry |
| `account.ts` | P1 | Password/email change, TOTP, delete account |
| `invitations.ts` | P1 | Invite lifecycle, seat cap enforcement |
| `team.ts` | P1 | Role changes, deactivation, reassignment |
| `supervisee.ts` | P1 | Log session hours |
| `clinical-form.ts` | P1 | RI clinical form save |
| `accept-invite.ts` | P1 | Invitation acceptance flow |
| `ai-note.ts` | P2 | AI note generation, transcript ingestion |
| `calendar-integrations.ts` | P2 | Calendar disconnect, preferred provider |
| `hris-import.ts` | P2 | CSV roster import action |
| `paycor-config.ts` | P2 | Paycor connect/disconnect |
| `rules.ts` | P2 | Rule assignment, obligation dates |
| `attestations.ts` | P2 | Supervisor attestations |
| `audit-log-export.ts` | P2 | One-time token generation |
| `notifications.ts` | P3 | Mark read, update prefs |
| `admin-enterprise.ts` | P3 | Promote to enterprise |
| `admin-founding.ts` | P3 | Toggle founding supervisor |
| `founding.ts` | P3 | Founding application |
| `lead-magnet.ts` | P3 | Lead capture |
| `contact.ts` | P3 | Contact form |

### API Routes — all 15 untested

| Route | Criticality |
|-------|-------------|
| `/api/stripe/webhook` | **P0** -- revenue-critical |
| `/api/cron/daily-checks` | **P0** -- compliance, trial warnings, account purge |
| `/api/cron/sign-reminders` | P1 -- signature reminder emails |
| `/api/cron/scheduled-session-reminders` | P1 |
| `/api/cron/rule-drift` | P1 -- rule change monitoring |
| `/api/cron/rules-update` | P2 |
| `/api/cron/paycor-sync` | P2 -- roster sync |
| `/api/cron/sftp-delivery` | P2 -- sealed PDF delivery |
| `/api/audit-log/export` | P2 |
| OAuth callbacks (MS + Google) | P2 |
| `/api/admin/reset-demo` | P3 |

### Infrastructure Gaps

- No `coverage` block in `vitest.config.ts`
- No security scanner in CI
- No visual regression tests
- Accessibility testing only on 5 marketing pages
- No property-based/fuzz testing
- Drizzle migration journal incomplete (0000-0017 tracked, 0018-0033 via repair script)

---

## 4. Audit Phases

Ten phases, ordered by blast radius.

### Phase 1: Static Analysis and Security Scan

| Check | Tool | Cost |
|-------|------|------|
| TypeScript strict mode (`npx tsc --noEmit`) | Built-in | Free |
| OWASP top-10 scan | Semgrep (`npx @semgrep/cli scan --config=auto --config=p/nextjs --config=p/owasp-top-ten`) | Free |
| Dependency CVEs | `npm audit --production` | Free |
| Secret scanning | `secretlint` or `trufflehog` | Free |
| JSX accessibility linting | `eslint-plugin-jsx-a11y` (extend to `recommended` -- Next.js only enables 6 of 36 rules) | Free |

Targets: SQL injection via raw queries, XSS via `dangerouslySetInnerHTML`, SSRF in OAuth callbacks, hardcoded secrets, insecure crypto, CSRF bypass in server actions.

### Phase 2: Server Action Unit Tests

Test every action's auth, validation, and error paths. Pattern:
```typescript
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/authz', () => ({ getCurrentMembership: vi.fn() }));
```

**Tier 1 (P0 -- must test before handoff):** `signatures.ts`, `billing.ts`, `auth.ts`, `sessions.ts`, `account.ts`
**Tier 2 (P1):** `invitations.ts`, `accept-invite.ts`, `team.ts`, `clinical-form.ts`, `supervisee.ts`
**Tier 3 (P2):** `ai-note.ts`, `rules.ts`, `attestations.ts`, remaining actions

### Phase 3: API Route and Cron Job Audit

- Stripe webhook: mock `constructEvent`, test idempotency via `processedStripeEvents` PK, test each event type handler. Improvement found: replace substring-match error catch with `onConflictDoNothing()`.
- Cron jobs: extract handler logic into testable functions, mock external services with MSW, use `vi.useFakeTimers()` for time-dependent logic.
- OAuth callbacks: mock token endpoints with MSW or `oauth2-mock-server`, verify encrypted token storage.
- Audit log export: verify one-time token, CSV injection protection, 10k row cap.

### Phase 4: RBAC and Multi-Tenant Isolation

- **Horizontal isolation**: Seed two orgs, call every data query with User A's session but Org B's resource IDs. Expect rejection.
- **Vertical escalation**: For every server action, call with each of the 4 roles. Verify exact pass/fail set.
- **IDOR**: Verify `[superviseeId]`, `[sessionId]`, evidence packageId all check org ownership.
- **Session invalidation**: Deactivation, "sign out everywhere", account deletion, role change -- all reflected in JWT callback.
- **Static analysis**: Semgrep or `ts-morph` rule flagging Drizzle queries on tenant-scoped tables missing `.where(eq(...orgId...))`.

### Phase 5: Stripe Billing and Subscription Lifecycle

Test with Stripe Test Clocks (free, max 3 customers/clock):
```
Trial (14d) -> Active -> Past Due -> Past Due Expired (7d grace) -> Canceled
                     -> Upgrade (Solo -> Practice, with proration)
                     -> Founding Supervisor ($0 forever)
```
- Seat enforcement: Solo=3, Practice=seatCount, Enterprise=unlimited
- AI note quota: 10/100/500 per month per tier
- Webhook idempotency: same event ID processed exactly once
- Tools: `stripe listen --forward-to localhost:3000/api/stripe/webhook`, `stripe trigger`, test cards (`4242...`, `4000000000000002` for decline)

### Phase 6: Signing, Evidence and PDF Integrity

- Dual-sign enforcement, server-side timestamps, append-only signatures
- SHA-256 hash over canonical JSON, public verification at `/verify/[packageId]`
- PDF output verification with `pdf-parse`:
  ```typescript
  const buffer = await renderToBuffer(<EvidencePdf data={testData} />);
  const parsed = await pdf(buffer);
  expect(parsed.text).toContain(expectedHash);
  ```
- Both templates: generic + RI clinical (3 or 4 pages)
- Evidence immutability: no UPDATE/DELETE on `evidence_packages` after creation

### Phase 7: Rules Engine Edge Cases

Already well-tested. Add: exact boundary values, timezone handling, overlapping obligation windows, rule version change mid-window, supervisee with no rule assigned, custom rule with all optional fields omitted.

### Phase 8: UI/UX Hostile Walkthrough

- Form abuse: empty, max-length, script tags, SQL fragments, unicode, emoji
- Property-based testing: `fast-check` + `zod-fast-check` to fuzz Zod validation schemas
- Navigation: back button double-submit, deep link to nonexistent IDs, rapid clicks, session expiry mid-form
- Mobile: iPhone 15 + iPad viewports, touch targets >= 44px
- Error states: 500 shows friendly message, loading skeletons, empty state CTAs
- Browser compat: Chrome, Firefox, Safari, Edge

### Phase 9: Accessibility Audit

Extend existing `@axe-core/playwright` pattern to all app pages:
```typescript
const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
expect(results.violations).toEqual([]);
```
Pages: Dashboard (4 role variants), roster, sign session, team, billing, account, calendar, audit log.
Add keyboard navigation tests and `eslint-plugin-jsx-a11y` with `recommended` preset.

### Phase 10: Performance and Edge Cases

- Large datasets: 100+ supervisees, 1000+ sessions, 10k+ audit log entries
- Concurrent operations: two users signing simultaneously, role change during active session
- Time edge cases: DST transitions, year boundary, leap year, midnight UTC

---

## 5. Tool Arsenal

| Tool | Category | Cost | Priority |
|------|----------|------|----------|
| **Vitest** | Unit testing | Free | Must-have |
| **Playwright** | E2E + visual regression (`toHaveScreenshot()`) | Free | Must-have |
| **@axe-core/playwright** | Accessibility | Free | Must-have |
| **Semgrep** | SAST security scanning | Free | Must-have |
| **fast-check** + **zod-fast-check** | Property-based testing / fuzzing | Free | Must-have |
| **pdf-parse** | PDF content verification | Free | Must-have |
| **MSW** (Mock Service Worker) | Mock external APIs in tests | Free | Must-have |
| **Stripe Test Clocks** | Billing lifecycle simulation | Free | Must-have |
| **Stripe CLI** (`stripe listen/trigger`) | Local webhook testing | Free | Must-have |
| **eslint-plugin-jsx-a11y** | JSX accessibility linting | Free | Should-have |
| **Lighthouse CI** | Performance + a11y scoring | Free | Should-have |
| **PGlite** (`@electric-sql/pglite`) | In-process Postgres for migration testing | Free | Should-have |
| **Testcontainers** | Ephemeral real Postgres in Docker | Free | Nice-to-have |
| **Neon branching** | Branch-per-PR database isolation | Free tier | Nice-to-have |

---

## 6. Prioritized Risk Register

### P0 — Blocks Client Handoff

| # | Risk | Impact |
|---|------|--------|
| 1 | Stripe webhook handler untested | Revenue loss, feature lockout |
| 2 | signSessionAction untested | Invalid evidence packages, legal liability |
| 3 | Auth actions untested | Unauthorized access, user lockout |
| 4 | No cross-org isolation tests | Data breach, regulatory violation |
| 5 | Billing actions untested | Wrong charges, failed billing |
| 6 | Cron jobs untested (7 jobs) | Missed compliance deadlines |
| 7 | No security scanning in CI | Undetected vulnerabilities ship |

### P1 — Should Fix Before Handoff

| # | Risk | Impact |
|---|------|--------|
| 8 | Account management untested (password, delete, TOTP) | User lockout |
| 9 | Invitation lifecycle untested (seat cap, token expiry) | Over-provisioning |
| 10 | Team management untested (role change, deactivation) | Privilege escalation |
| 11 | PDF output not programmatically verified | Incorrect legal documents |
| 12 | No coverage reporting | Blind spots invisible |
| 13 | App pages have no a11y audit | ADA compliance risk |
| 14 | Clinical form save action untested | RI form data loss |

### P2 — Fix Post-Handoff

| # | Risk | Impact |
|---|------|--------|
| 15 | No visual regression testing | Unnoticed UI breakage |
| 16 | No property-based testing | Edge case inputs slip through |
| 17 | OAuth callback handlers untested | Calendar integration failures |
| 18 | AI note generation untested | Wasted API calls, PHI leakage |
| 19 | Performance under large datasets unverified | Slow dashboards |
| 20 | Migration journal incomplete (0018-0033 gap) | Silent migration failures |

---

## 7. Execution Schedule

### Week 1: Foundation
| Day | Work |
|-----|------|
| 1 | Phase 1: Semgrep + npm audit + secret scan + TS strict check |
| 2 | Phase 2: `signatures.ts` + `billing.ts` action tests |
| 3 | Phase 2: `auth.ts` + `sessions.ts` action tests |
| 4 | Phase 2: `account.ts` + `invitations.ts` action tests |
| 5 | Phase 3: Stripe webhook handler tests |

### Week 2: Critical Paths
| Day | Work |
|-----|------|
| 6 | Phase 3: Cron job tests (daily-checks, sign-reminders, session-reminders) |
| 7 | Phase 4: Cross-org isolation tests + IDOR checks |
| 8 | Phase 5: Stripe lifecycle with test clocks |
| 9 | Phase 6: Evidence + PDF integrity tests |
| 10 | Phase 2 Tier 2: team.ts, clinical-form.ts, ai-note.ts |

### Week 3: Polish
| Day | Work |
|-----|------|
| 11 | Phase 7: Rules engine edge cases |
| 12 | Phase 8: UI hostile walkthrough (manual + fast-check) |
| 13 | Phase 9: Accessibility audit (extend axe to all app pages) |
| 14 | Phase 10: Performance + edge cases |
| 15 | Fix critical findings, re-run full suite, handoff readiness report |

### Infrastructure (Parallel)
- [ ] Configure Vitest coverage reporting (`v8` provider)
- [ ] Add Semgrep to CI
- [ ] Install Stripe CLI for local webhook testing
- [ ] Add `eslint-plugin-jsx-a11y` recommended preset
- [ ] Fix Drizzle migration journal (add entries for 0018-0033)

---

## 8. Success Criteria

The app is ready for client handoff when:

1. All 7 P0 risks resolved (tests written and passing)
2. Zero critical/high Semgrep findings
3. Zero critical npm audit findings
4. Vitest coverage > 70% on server actions and API routes
5. All E2E specs passing (including new hostile + a11y specs)
6. Stripe subscription lifecycle tested end-to-end with test clocks
7. Cross-org data isolation proven via automated tests
8. Evidence package hash verification tested
9. PDF output programmatically verified for both templates
10. Dashboard a11y audit passes (zero axe violations)
