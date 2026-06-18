# Wave 1 implementation plan — UI cleanup + RI prep

> Written 2026-06-18 by the prior session at end-of-context. Caleb is
> picking work back up in a fresh chat. **Read AGENTS.md first** — project
> rules, git identity, authorization scope, working preferences. Memory
> auto-loads from `C:\Users\Caleb\.claude\projects\C--code-audithalo\memory\`.

## Why this doc exists

Recovery Innovations (RI) is the lead paying-customer conversation. A
meeting on 2026-06-17 generated five aligned decisions that change the
roadmap (HRIS real-time sync, SFTP-to-Paycor PDF delivery, PRN/on-leave
lifecycle, Joint Commission overlay, AI performance summaries).
Independently, Caleb's UI testing on the seeded Atlas Counseling Group
data surfaced seven cleanup items. This doc captures the combined Wave 1
plan so the implementation session has a clean orientation without
relying on chat scrollback.

Wave 2-4 plan lives in chat history of the prior session, but the
short version is at the bottom under "How this connects to Waves 2-4."

## State of the world (as of 2026-06-18)

- Latest commit on `main`: `7338099 chore: stop tracking stale handoff + dev-log scratch files`
- Production deploys: `audithalo-r9l236x9g` (Ready, 2d old), `audithalo-7b1bh5fx8` (Ready)
- Aliased to: `audithalo.com` (marketing) and `app.audithalo.com` (app)
- Demo org: `Atlas Counseling Group` (Practice tier, 20 seats, seeded
  2026-06-15). Login creds in `.env.local` under `DEMO_*`.
- Sign-reminders cron green; Playwright local 57/57 against prod.
- Tech-stack sweep complete — see "Verified state" below.

## Caleb's testing observations that drove this plan

| # | Observation | Read |
|---|---|---|
| A | Evidence-packages marketing box on the dashboard links OUT to a sales page — delete for all roles | Pure delete. In-app marketing belongs on marketing site, not behind login |
| B | Repeated 13× "30/31-day gap exceeds 14-day maximum" wall on supervisee detail page | Gap renderer doesn't group same-kind gaps. Fix in `_gap-renderer.tsx` |
| C | Surface says "pending signature" but the session opens to a no-show branch | **Filter-sync bug.** Multiple surfaces derive pending-state; some don't filter `scheduledStatus = 'no_show'`. Identify all + sync them |
| D | "Needs your attention — N pending" duplicates the monthly session log; replace with per-month `(N pending)` indicators | Reclaims dashboard vertical space; better temporal context |
| E | Sign-page vs scheduled-page transitions look inconsistent across the seeded sessions | State-machine logic IS built but the user experience across role × lifecycle state isn't audited. Build a matrix, fix gaps |
| F | Supervisor "Today" widget — supervisee name links to their profile, should link to session/join | One-line link target change in `_todays-schedule.tsx` |
| G | "Customize state rules" button on `/dashboard/team` duplicates the profile dropdown nav | One-line delete |

## Explanation of (C) — no-show vs pending contradiction

The no-show row in the test data is real — it came from
`scripts/seed-demo-org.ts` deliberately, to give the demo a row exercising
the no-show branch UI. Emily Thompson has one row with
`scheduledStatus = 'no_show'`, empty signatures, dated ~10 days ago.
Nothing in the app auto-flipped it.

The contradiction is that *some* surface still surfaces that no-show row
as "pending." The supervisee-side path got cleaned (`pendingSignaturesForUser`
excludes no_show, sign page has no_show branch, this-week widget filters it,
`signSessionAction` rejects no-show). Some OTHER surface — likely the
supervisor-side roster `pendingSignatureCount`, the bell-notification copy,
or `src/components/app/session-log.tsx` — didn't get the same treatment.

**Pass 2 is the systematic fix:** grep every code path that derives
pending / needs-sign state. Confirm each applies the same filter set
(`scheduledStatus !== 'canceled' && !== 'no_show'`, meeting end-time has
passed, user-hasn't-already-signed). Fix any that don't.

## Implementation passes

Order is by dependency + risk, not calendar.

### Pass 1 — Removals + one-line fixes (lowest risk, ~20 min)

1. **A** — delete the evidence-packages marketing box. Grep first for the
   string "Evidence packages" inside `src/app/app/` to find all renderers
   (likely on HR Admin / Supervisor / Supervisee dashboards). Confirm
   there are no sibling in-app marketing boxes that should also go (do
   the same grep with "Audit-ready" / "Hand it to the board" / similar
   sales copy).
2. **G** — delete "Customize state rules" button from
   `src/app/app/dashboard/team/page.tsx`. (Same button I changed from
   destructive to default variant earlier — now remove entirely.)
3. **F** — switch the supervisor "Today" widget link target. Currently
   the supervisee name in
   `src/app/app/dashboard/_todays-schedule.tsx` links to
   `/dashboard/roster/{superviseeId}`; should link to
   `/sign/{sessionId}` so the supervisor can hit Join + sign from one
   click path.

Ship as one commit, lint+test+build green, PUSHING.md identity flags.

### Pass 2 — Investigate then fix no-show/pending filter sync (~2-3 hrs)

**Investigation first** (don't edit anything):

Grep targets to identify every surface that derives "pending sign" /
"needs sign" / "pending signature count" state:

```bash
grep -rn "pendingSignature\|signedAt === null\|signedAt IS NULL\|needs.*sign\|pending.*sig" src/
grep -rn "pendingForMe\|pendingForUser\|pendingSignaturesForUser" src/
grep -rn "session_no_show\|signature_needed" src/lib/notifications
```

For each match, confirm the code applies the full filter:
- `kind === 'supervision'`
- `signedAt === null`
- `scheduledStatus !== 'canceled'`
- `scheduledStatus !== 'no_show'`
- meeting end-time has passed (`startMs + durationHours * 60 * 60_000 <= now`)
- (for per-user views) user-hasn't-already-signed

Surfaces to scrutinize:
- `src/lib/db/roster-queries.ts` — `pendingSignatureCount` (was patched
  earlier; reconfirm)
- `src/lib/supervisee.ts` — `pendingSignaturesForUser` (was patched
  earlier; reconfirm)
- `src/app/app/dashboard/_supervisor-dashboard.tsx` — KPI cards + at-risk
  list footer (was patched but double-check)
- `src/components/app/session-log.tsx` — month-grouped session list
  (likely-suspect: the "(2 pending)" hint in screenshots, may not filter
  no_show)
- `src/app/app/dashboard/roster/page.tsx` — pending column
- `src/app/app/_notifications-bell.tsx` — copy / list logic
- Anywhere in `src/lib/notifications` that constructs
  `signature_needed` notifications — confirm a no_show flip suppresses
  pending notifications

Document findings in a quick table (surface → filter applied → gap),
share with Caleb before any fixes ship.

**Then fix** — sweep all gaps in one PR with a test (or augment
existing tests) that asserts no_show rows never appear in any
pending-signature aggregate.

### Pass 3 — Gap renderer grouping (~2-3 hrs)

`src/app/app/dashboard/roster/[superviseeId]/_gap-renderer.tsx` currently
renders one card per `Gap` from the rule engine. Same-kind gaps
(`individual_supervision_cadence` with 13 different windows, for example)
stack as 13 visually identical cards. Group them:

- Same `checkId` → collapse into one card with a count.
- Card shows: friendly check name, count of windows, the worst window
  ("longest gap = 31 days"), one combined action button.
- Expanding the card reveals the individual gap details (one row per
  window).
- Other gap kinds (`pre_registration_required`,
  `supervisor_credential_required`, `supervision_ratio_per_practice_block`,
  `individual_supervision_minimum_share`, etc.) usually only emit one
  card per kind anyway — the grouping just collapses repeats.

Rule-engine data is in
`src/lib/rules/checks.ts` — confirm whether grouping belongs in the
renderer (presentation) or in the rule engine (data shape). Renderer
is cleaner since the engine's job is to find every gap; the UI's job is
to summarize them.

### Pass 4 — Sign / scheduled state-machine audit (~3-4 hrs, audit-first)

Read the actual code path + click through seeded test data for each
role at each lifecycle state. Build the matrix:

| Lifecycle state | Supervisor view | Supervisee view | HR Admin view |
|---|---|---|---|
| Scheduled, before start | ScheduledSessionCard with Join + Cancel + Reschedule + No-show | Same minus Cancel/Reschedule (HR Admin or original logger only) | Same as supervisor |
| In meeting window (start ≤ now < end) | … | … | … |
| Ended, awaiting signatures | Sign form | Sign form | View-only badge |
| Awaiting one signature | Recorded badge | Sign form (if not yet) or recorded badge | View-only |
| Fully signed (sealed) | "Fully signed" badge | "Fully signed" | View-only |
| Canceled | Canceled card | Canceled card | Canceled card |
| No-show | No-show card | No-show card | No-show card |

Fill in. For every cell that's inconsistent / surprising / wrong, propose
a specific fix (copy or layout). Goal: a single predictable
state-machine — surface, copy, affordances all derive from
(`scheduledStatus`, `signedAt`, `signatures[]`, role, time-relative-to-meeting).

Includes the calendar-integration angle:
- Meeting Join URL visible only during meeting window (and possibly the
  5min pre-buffer)
- Transcript-paste UI + AI-note generation only when post-meeting AND
  not yet signed AND viewer is supervisor
- Calendar event in Outlook/Teams/Google matches what the in-app view
  says

### Pass 5 — Supervisee dashboard consolidation (~3-4 hrs)

Built only after Passes 1-4 reduce the noise:

- **Remove** the "Needs your attention — N pending" callout section
  (currently `pendingForMe` mapped to a colored list above the
  this-week widget)
- **Update** `src/components/app/session-log.tsx` to render
  `(N pending)` next to each month label when that month has unsigned
  past-meeting sessions
- **Keep** the four status cards (practice / supervision / status /
  pending) — they're the at-a-glance summary
- **Keep** the this-week widget — it's the forward-looking calendar
- **Reconsider** the "Log practice hours" form's position — currently
  bottom; possibly its own surface

Net: dashboard becomes [status cards] → [this week] → [session log
accordion with pending counts inline] → [log form].

Open question for Caleb: should the per-month accordion default to
"current month expanded, prior months collapsed"? Probably yes.

### Pass 6 — Earlier Wave 1 items (carried forward)

- **F5 freshness fix** — deactivated members keep JWT until expiry.
  Fix in NextAuth `jwt` callback at `src/auth.ts:82` — check
  `dbUser.deletedAt` (already done) AND
  `org_memberships.deactivated_at` (NOT done). ~2 hrs.
- **F1 freshness fix** — stale `session.user.name` in header after
  edit. Same callback. Natural same-PR companion. ~1 hr.
- **Float-formatting sweep** — every surface that renders hours;
  mirror the `.toFixed(1)` fix from the roster. Sites to check:
  supervisee dashboard headline (already `.toFixed(0)` — bump to `.1`),
  executive dashboard, sealed PDF, audit-log export. ~30 min.
- **Empty-state polish from Horseman 4** — Structured overline rename,
  lowercase severity caps, 12h-picker tap targets, empty-org HR Admin
  CTA, this-week empty fallback. ~1 hr total.
- **Session-reminders scheduler** — pick (a) cron-job.org, (b) Vercel
  Pro, (c) drop route. Recommend (a). ~1 hr if (a).
- **Sentry / Stripe / Resend dashboard verification** — Caleb does these
  at convenience.

### Pass 7 — RI external work (runs in parallel to Pass 1-6)

- **Draft + send the RI lifecycle one-pager** for hire / terminate /
  PRN / on-leave / return-from-leave logic. Cheapest unblocker for
  Wave 2 (auto-provisioning). The session can draft this; Caleb sends.
- **PDF templates request follow-up** — Caleb already drafted the email
  in chat; if no response by end of week, send a polite ping.
- **Paycor SFTP verification** — email to Paycor partner support: do
  they expose SFTP for per-employee document folders, what's the auth
  pattern, size limits, naming conventions. Without this confirmation,
  Wave 2.4 SFTP code is speculative.

## Verified state from the tech-stack sweep (do not re-investigate)

- 31 Vercel env vars set for Production + Preview (Stripe, Resend,
  Sentry ×4, PostHog ×2, MS, Google, OpenAI, DB, Auth, etc.)
- Sentry wiring complete in code:
  `sentry.server.config.ts` + `sentry.edge.config.ts` +
  `src/instrumentation.ts` + `src/instrumentation-client.ts` +
  `withSentryConfig` in `next.config.ts`. Source-map upload + tunnel
  route `/monitoring` + PHI-safe replay all configured.
- Stripe webhook signature verification via
  `stripe.webhooks.constructEvent` at
  `src/app/api/stripe/webhook/route.ts:79`.
- Resend DKIM configured at `resend._domainkey.audithalo.com`;
  send-subdomain SPF at `send.audithalo.com`; DMARC at `_dmarc.audithalo.com`
  with `p=none`.
- Sign-reminders cron firing reliably (every ~2 hrs from GitHub Actions
  schedule).
- Only one Vercel project (`audithalo`); the `-audit-helo` suffix in URLs
  is the team slug, not a separate orphan project.
- Playwright suite local 57/57 against prod; the CI failure on commit
  `179e321` was flaky / environmental, not a real regression.

## Open decisions

1. **Pass 5 default month accordion behavior** — current month expanded,
   prior collapsed? (Recommend yes.)
2. **Session-reminders scheduler** — confirm cron-job.org as the path.
3. **F5 fix priority** — Wave 1 (recommended) or later?
4. **Wave 1 PR shape** — one big bundled PR vs piecewise per pass?
   (Recommend per-pass for review clarity; ~5-7 small commits.)
5. **Real-time SLA for RI Paycor sync** — sub-minute (direct Paycor
   webhooks) vs minutes-ok (Merge.dev polling). Affects Wave 2.3
   architecture. RI needs to commit to a number.

## What this session can do autonomously vs needs Caleb

**Autonomous (PUSHING.md identity flags, no Caleb required):**
- All code changes for Pass 1-6
- All test writing (vitest + Playwright)
- Doc updates inside `docs/strategy/`
- Cleanup commits

**Needs Caleb's hands:**
- Vercel dashboard work (env vars, project settings)
- Stripe / Resend / Sentry dashboard verifications
- DNS changes
- Customer-facing emails to RI (drafts okay; send is Caleb's call)
- Pricing-tier decisions
- Legal review for AI performance summaries (Wave 3)

**Per AGENTS.md gate** — any prod-DB write needs explicit "yes":
- Schema migrations (Wave 2)
- Reseeding / data corrections
- Bulk soft-deletes

## How this connects to Waves 2-4

After Wave 1 (this plan) ships, the path is:

- **Wave 2 — RI integration core (gated on lifecycle one-pager sign-off + Paycor SFTP confirmed):** lifecycle state expansion (`leave_status` column + UI + rule-engine pause), auto-provisioning service, Paycor sync (direct vs Merge.dev based on SLA), SFTP delivery for sealed PDFs, PDF template wiring.
- **Wave 3 — Broader feature work:** Joint Commission overlay (scope after RI specifies), post-seal correction flow (we owe RI this — I claimed it existed when it didn't), AI performance review summaries (with reviewer-signoff step + legal disclaimers), account data export, hostile E2E suites (cross-org, inputs, race), remaining freshness audit findings F4 / F11 / F13 / F14.
- **Wave 4 — Production-grade launch:** HIPAA Option 4 migration, SOC 2 readiness, SSO / SAML, Horseman 3 perf findings (15-query waterfall, bell-poll cadence at scale), marketing Phase 3 (once pricing locks).

## File pointers (avoid re-discovery)

- Plan structure: `docs/strategy/01-launch-plan.md` through
  `docs/strategy/11-demo-readiness-test-plan.md` (this is #12)
- Freshness audit findings F1-F14 with status legend:
  `docs/strategy/10-freshness-audit.md`
- HRIS Phase 1-3 spec: `docs/strategy/05-hris-integration.md`
- RBAC matrix: `docs/strategy/04-enterprise-rbac.md`
- Scheduling: `docs/strategy/08-scheduling-and-calendar.md`
- Rules-admin: `docs/strategy/09-rules-admin.md`
- Pushing to main: `docs/PUSHING.md`
- Demo readiness pass artifacts:
  `docs/strategy/11-demo-readiness-test-plan.md`
- Seeded org script: `scripts/seed-demo-org.ts`
- Password reset script: `scripts/reset-demo-passwords.ts`
- 2FA check script: `scripts/check-test-accounts-2fa.ts`

## Suggested first action for the new session

Start with Pass 1 (the three removals). One commit, PUSHING.md identity
flags, lint+test+build green before push. Then run the Pass 2
investigation grep WITHOUT making code changes — surface the filter-sync
findings table to Caleb before any Pass 2 fixes ship.
