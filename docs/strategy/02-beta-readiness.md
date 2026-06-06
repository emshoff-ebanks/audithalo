# Beta Readiness — gap report

_Drafted 2026-06-05. Current branch: `main` @ `0ad7baf`. Production at audithalo.com + app.audithalo.com._

This is an audit of where the app stands vs. what's actually needed to invite real beta users (paying solo supervisors). It's separate from the enterprise roadmap (see §3) — those are different sales motions.

## 1. What's already shipped (don't redo)

Reading the last ~25 commits, here's the working surface:

- **Auth + account** — register / login / forgot-password / reset-password / verify-email / change-email all live. JWT sessions. Account page reordered with anchor nav (just shipped).
- **Billing** — Stripe Checkout for Solo monthly/yearly + Practice (base + per-seat). Webhook handler with idempotency (`processed_stripe_events`). Billing banner on dashboard.
- **Rule engine** — 5 jurisdictions (CA APCC, FL RMHCI, NC LCMHCA, NY LMHC-LP, TX LPC-Associate) under `rules/*/v1.yaml`. Versioned. Drift detection + per-supervisee re-evaluation shipped Phase 6.0. Per-state guidance in the assign-rule form (just shipped).
- **Session log** — practice + supervision events, signing flow, evidence packages, verify-by-package-id public page.
- **Notifications** — bell dropdown + email + daily cron (`/api/cron/daily-checks`). Rule-changed, invite, evidence-sealed, sign-event emails all wired.
- **Marketing** — pricing, features, evidence-packages, security, contact, states/[slug], per-license SEO landing pages, JSON-LD, sitemap, OG images. `/for-practices` redirects to `/for-group-practices` (no dup).
- **Observability** — Sentry SDK in `src/instrumentation.ts` + `src/instrumentation-client.ts`. User context wired.
- **Mobile** — viewport export, roster card layout for narrow screens, bell dropdown clipping fix.

## 2. What's blocking beta (real gaps)

Ordered by user-visible impact:

### 2a. Invite-with-rule + convert-on-accept (Phase 7-A)
**Why blocking:** Right now an invite produces a supervisee with no rule assigned. The supervisor has to come back and assign one, which is the most common drop-off. Onboarding step 4 (assign state rule) stays red until they do.

Also: when a supervisor invites an email that already has an account, the flow currently errors. Damon picked Option C — convert-on-accept (the existing user keeps their identity, just gets an `org_memberships` row added).

**Schema needed:** add `pending_rule_id text` (nullable) to `invitations`. On accept, if present, write the rule assignment in the same transaction.

**Effort:** ~half-day. Single migration + one server action change + one form-field addition.

### 2b. Pre-commit seats at checkout (Phase 7-B)
**Why blocking:** Damon picked Option A. A 5-supervisee practice should be able to enter "5" at checkout and have those seats committed up-front (single Stripe line item with `quantity: 5`), instead of being incremented one-at-a-time as they invite. Today the seat-quantity logic lives in `seats.ts` and assumes 1-by-1 increments via the team page.

**What changes:**
- Checkout session for Practice needs a seat-quantity selector (radio: 1, 3, 5, 10, custom).
- Webhook handler needs to set `seatCount` from `line_items.quantity` instead of computing from invite count.
- Seat-cap check (`seatCapBlockedReason`) needs to treat `seatCount` as a ceiling that the supervisor purchased, not a derived count.

**Effort:** ~1 day. Touches Stripe checkout session, webhook reconciliation, seats.ts, and the team page invite UI (remove auto-increment-quantity).

### 2c. State rule monitoring pipeline
**Why blocking long-term, not pre-beta:** Memory flags this as the "core moat." It's currently a story we tell on the website (security + states pages) but there's no actual monitoring running. If TX moves the citation URL again (it did once already during research), CA APCC bumps its training hours, etc. — we won't catch it until a customer reports it.

**Minimum-viable version for beta:**
- Cron job (weekly) that fetches each rule's `source_url` and stores a hash. Diff on next run → admin alert via email.
- Internal `/admin/rule-drift` page listing flagged rules with "verified-no-change" and "needs-update" actions. (Admin = `users.role = 'admin'`, which doesn't exist yet — add `is_admin boolean` to users table or check against an allowlist env var for v1.)

**Effort:** 1-2 days. Can ship without state-register RSS scraping or Visualping — those are post-beta.

### 2d. Account deletion + data export (compliance hygiene)
**Why blocking:** GDPR/CCPA/Vermont — a SaaS that holds professional records needs a "delete my account" button and a "download my data" button. Cheap to build, but absent today.
- Delete: soft-delete (`deletedAt` timestamp on `users`), cron job purges after 30 days.
- Export: zip of evidence packages + JSON dump of session events for the requesting user.

**Effort:** ~half-day for delete + 1 day for export.

### 2e. Trial-end + grace-period messaging
**Why blocking:** Today the billing banner says "trial expires Oct 16" but there's no in-app messaging at T-7 days or T-1 day, and no graceful degradation when the trial ends (the app just stops letting them sign events). Beta users should get an in-app banner + an email at T-3.

**Effort:** ~2 hours. Add a notification template + a daily-cron rule.

### 2f. Demo seed reliability
**Why blocking:** Memory says demo creds may not exist in prod. If we're inviting beta users to "try the demo" first, the seed needs to be reproducible: a one-shot admin endpoint or a CI job that resets the demo org weekly.

**Effort:** ~2 hours if we just ship a `/api/admin/reset-demo` endpoint behind the admin gate from §2c.

### 2g. Error handling for the YAML rule loader
**Why blocking:** If a deploy ships a malformed rule YAML, `loadAllRules()` throws and every page that touches the rule catalog 500s. The roster page is one of those. Need a Zod-validate-at-build-step (next.config.ts build hook) so bad YAML fails the deploy, not production.

**Effort:** ~1 hour.

## 3. Enterprise track (next cycle, separate from beta)

User said: _"the next push I think we should start developing the enterprise package next… create a plan for tackling that and bulk uploading the changes once we're done."_

Enterprise here means **group-practice tier** (10+ supervisees, multiple supervisors). Distinct from the solo-supervisor beta motion. Major axes:

1. **Multi-supervisor org** — today an org has one supervisor + N supervisees. Enterprise needs N supervisors with delegated permissions (who can edit rules, who can sign, who can invite, who can see billing).
2. **Roles + RBAC** — `users.role` was just collapsed to `manager | supervisee` in migration 0016. Enterprise re-expands this to at least `owner | supervisor | reviewer | supervisee | viewer`. Worth doing as a new column (`org_memberships.permissions jsonb`) rather than enum proliferation.
3. **Executive dashboard** — practice-wide rollup: how many supervisees at risk, hours logged this month, evidence packages sealed. Today the supervisor sees their own roster only. Pricing page already promises this — it's a debt.
4. **HR/onboarding flows** — invite via CSV upload, bulk-assign a default rule based on state, integrate with the practice's IdP (Google Workspace SSO for v1, SAML later).
5. **Billing — annual invoicing** — enterprise customers want to pay annually by invoice, not monthly by card. Stripe invoicing API.
6. **SLA + audit log retention** — pricing page promises "7-year audit log retention." Actual retention today is unbounded but unenforced. Need a documented retention policy + a way to extract the audit log for a date range.
7. **PHI hardening** — memory note from 2026-06-02: NY supervision notes _can_ contain PHI depending on practice. For enterprise, add explicit PHI mode (encryption-at-rest beyond Neon's default, BAA with Resend + Vercel, in-app warning when free-text fields might contain PHI).

**Suggested sequencing:**
- **Cycle 1 (enterprise foundation):** multi-supervisor org + RBAC + invite-by-CSV. ~1 week.
- **Cycle 2 (executive value):** practice-wide rollup dashboard + audit-log retention. ~1 week.
- **Cycle 3 (sales-ready):** annual invoicing + SSO + BAA paperwork. ~1 week.

Each cycle = one branch, one bulk merge, no rolling deploys.

## 4. Recommended order

Pre-beta (this cycle, ~3-4 days bundled into one merge):
1. Phase 7-A (invite-with-rule + convert-on-accept) — §2a
2. Phase 7-B (pre-commit seats) — §2b
3. Trial-end messaging — §2e
4. YAML build-step validation — §2g
5. Admin gate + minimal rule-drift monitor — §2c (MVP only)
6. Account deletion — §2d (delete first; export can be cycle-2)

Then open beta. Enterprise cycle 1 starts after first beta feedback wave.

## 5. Open questions for Damon

- Beta target: paid from day one, or 30-day free trial extension during beta?
- Beta size: 5 supervisors? 25? (affects how aggressive demo-reset cadence needs to be)
- Admin gating: env var allowlist (simplest), or proper `is_admin` column? Allowlist is fine for one of us.
- Should `/admin/rule-drift` be the seed of a real internal tool, or a one-off script we run manually? Leaning internal tool — it's also where the executive dashboard for enterprise eventually lives.
