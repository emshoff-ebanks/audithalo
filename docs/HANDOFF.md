# AuditHalo — Cross-Session Handoff

**Purpose.** Long-form orientation for a new chat picking up AuditHalo work. The minimum runtime contract lives in `AGENTS.md` (auto-loaded by Claude Code). This doc covers what AGENTS.md doesn't: phase history, schema overview, brand reference, the rule engine, and common traps. Read AGENTS.md first, then come here.

**Last updated**: 2026-06-29 (Wave 2 / Phase 1.1 just shipped; lint baseline cleaned).

---

## 1. The product in one paragraph

AuditHalo is a vertical SaaS that produces **state-board-audit-ready evidence packages** for the supervision of pre-licensed mental health counselors (LCMHCA in NC, APCC in CA, LPC-Associate in TX, RMHCI in FL, LMHC Limited Permit in NY at launch). The supervisor is the buyer; the supervisee is free. The moat is a curated, versioned, citation-grounded **multi-state rules engine** plus the maintenance discipline to keep it current. The wedge over EHRs (SimplePractice, TherapyNotes, ICANotes) is that they handle the *clinical* workflow but not the *regulatory* one — none ship an audit-ready evidence package keyed to a specific state's admin code.

Two domains:

- **audithalo.com** — marketing site
- **app.audithalo.com** — the product

Both are one Next.js app, routed by host via a proxy.

## 2. People + context

- **Caleb** is the active developer (90% owner-in-waiting). Memory-store has his role + preferences.
- **Damon** is Caleb's boss at Medipyxis and the original product owner. Contact `info@audithalo.com`.
- GitHub login on commits + pushes: `emshoff-ebanks` (numeric ID `228783329`).
- **Matt + Nick** are Medipyxis senior devs available for code review and general patterns; NOT Paycor specialists despite an earlier characterization.
- **Recovery Innovations (RI)** is the lead paying customer; full context in `docs/strategy/13-paycor-integration.md` and memory `project_ri_customer.md`.

Original AuditHalo was built on Emergent. This is the clean rebuild.

## 3. Hard rules

AGENTS.md owns the active rules. Worth repeating because they're load-bearing:

- **Never push or commit under any identity other than `emshoff-ebanks`** (ID `228783329`). A CI gate at `ci/forbidden-patterns.sh` blocks an old personal-billing account.
- **Read `docs/PUSHING.md`** before committing or pushing. Use `-c user.email=...@users.noreply.github.com -c user.name="emshoff-ebanks"` per-command identity flags.
- **Never run anything that touches prod Neon** without an explicit "yes" from Caleb. AGENTS.md lists the gated commands.
- **Don't raise the Vercel/GitHub attribution mismatch** — it's known and accepted. Move on.

## 4. Stack snapshot

Stack as of 2026-06-29:

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | **Next.js 16.2.6** (App Router, Turbopack) | `proxy.ts` handles host-based routing — replaces deprecated middleware. |
| Language | TypeScript 5 strict |
| Styling | **Tailwind CSS 4** | `@theme` directive in `src/app/globals.css` exposes brand tokens. |
| UI | **shadcn/ui** + Radix primitives | Wired manually. |
| Auth | **Auth.js v5 beta** | `src/auth.ts`. JWT sessions, bcryptjs, TOTP support, deactivation-aware (F5 fix). |
| DB | **Neon Postgres** | Dev + prod share one Neon DB (`ep-flat-butterfly-...`) — verified 2026-06-29. Action item: split prod into separate Neon branch before RI go-live. |
| ORM | **Drizzle 0.45.2** | Migrations: `drizzle/*.sql`. Use `scripts/repair-migrations.ts` to apply (see AGENTS.md). |
| Rules | YAML + Zod, evaluator + 13 checks | `rules/<slug>/vN.yaml`. Engine + custom overrides + version drift. |
| PDFs | `@react-pdf/renderer` |
| Email | **Resend** v6 | Configured in prod (RESEND_API_KEY + AUDIENCE_ID + EMAIL_FROM set). Falls back to console locally. |
| Billing | **Stripe** v22 | Solo + Practice tiers, 14-day trial, webhook signature-verified. RI is on a custom upfront-commission plan (see strategy doc 13). |
| AI | OpenAI SDK v6 | Session-note generation. Quota gated via `aiNoteQuotaBlockedReason`. RI carved out per `docs/strategy/13` "Pricing note." |
| Errors | **Sentry** | Wired + populated in prod (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`). |
| Analytics | **PostHog** | Wired + populated in prod. |
| Calendar | **Microsoft Graph (Teams + Outlook)** + **Google Meet + Calendar** | OAuth + per-user encrypted tokens. See `docs/strategy/08-scheduling-and-calendar.md`. |
| Tests | **Vitest 4** | **420 tests** as of 2026-06-29, all passing. `tests/setup.ts` loads `.env.local`. |
| E2E | **Playwright** | Specs in `e2e/`. Demo-smoke spec gates the demo flow. |
| Hosting | **Vercel** | Auto-deploys on push to `main`. Both `audithalo.com` and `app.audithalo.com` are one project. |

## 5. What is live end-to-end

A clinician's full lifecycle ships today:

1. **Marketing site** — home, features, pricing, for-supervisors, for-group-practices, security, evidence-packages, states (5 per-state pages with verification badge), legal (privacy + terms), founding-supervisor application, lead-magnets, supervision-log-template.
2. **Self-signup** at `/register` — supervisor role auto-creates a personal org.
3. **HR Admin team management** at `/dashboard/team` — invite supervisors / executives / HR admins, reassign supervisees, deactivate members, CSV bulk import.
4. **Roster** at `/dashboard/roster` — filter by supervisor, paginated, pending-invite actions.
5. **Supervisee detail** at `/dashboard/roster/[id]` — rule assignment, hour log, gap renderer with same-check grouping, evidence packages, session log accordion with per-month pending counts.
6. **Scheduling** — Google Meet + MS Teams OAuth, recurring series, conflict detection, sign-reminders cron (currently paused). Calendar view at `/dashboard/calendar`.
7. **Sign + seal flow** at `/sign/[id]` — pre-meeting (Join + Cancel + Reschedule + No-show), post-meeting (AI-note generation + Sign form + DidntHappenAffordance). Permission helper `signPermissions` centralizes UI + server authz.
8. **AI session notes** — paste transcript, generate via OpenAI, supervisor reviews + edits, signs into the seal. (Phase 3G upgrade to bot-as-attendee capture is on the Wave 2 roadmap.)
9. **Evidence packages** — canonical JSON + SHA-256 hash on seal, PDF generation at `/api/evidence/[id]`, public verification at `/marketing/verify/[id]`.
10. **Rules admin** at `/dashboard/team/rules` — view canonical rules, create org-level overrides, build custom rules, see version drift, reapply to supervisees.
11. **Billing** at `/dashboard/billing` — Stripe Checkout, Customer Portal, seat count tracking, AI-note quota per tier.
12. **Executive overview** at `/dashboard/executive` — read-only rollup for executives.
13. **Audit log** at `/dashboard/audit-log` — exportable, with TOTP gate for HR Admin export.
14. **Account** at `/dashboard/account` — profile edit, password, 2FA setup, notification preferences, sign-out-everywhere, account deletion.
15. **Lifecycle state** (Wave 2 Phase 1.1, shipped 2026-06-29) — `org_memberships.leave_status` (active / on_leave / prn). Rule engine pauses cadence checks for `on_leave`. UI badges on roster + team + supervisee dashboard.

## 6. Phase status (high level)

Detailed history is in `git log`. Recent waves:

| Wave / Phase | Status | Reference |
| --- | --- | --- |
| Phase 0-2 (infra → MVP) | DONE | pre-2026-06-01 |
| Phase 3 cycles 1-7 (rules admin) | DONE | `docs/strategy/09-rules-admin.md` |
| Phase 4 (AI docs + scheduling foundations) | DONE | `docs/strategy/08-scheduling-and-calendar.md` |
| Phase 5 (Practice tier scheduling features) | DONE | scheduling commits + sign-reminders cron |
| Phase 6 / demo-readiness | DONE | `docs/strategy/11-demo-readiness-test-plan.md` |
| Wave 1 — UI cleanup + RI prep (7 passes) | DONE 2026-06-19 | `docs/strategy/12-wave-1-implementation-plan.md` |
| Wave 2 Phase 0 (planning docs) | DONE 2026-06-24 | `docs/strategy/13-paycor-integration.md` |
| Wave 2 Phase 1.1 (lifecycle state) | DONE 2026-06-29 | commit `1ef945e` |
| Wave 2 Phase 1.2 (state-rules auto-update cron) | NOT STARTED | spec in `docs/strategy/13`, state half unblocked |
| Wave 2 Phase 2 (SFTP / template / auto-provisioning scaffolding) | BLOCKED | needs RI's PDF template + Paycor admin contact |
| Wave 2 Phase 3 (full Paycor + SFTP integration) | BLOCKED | needs Paycor partner support + Matt+Nick logic |
| Wave 3 (AI transcription, performance summaries, post-seal correction) | NOT STARTED | depends on Wave 2 live |
| Wave 4 (HIPAA, SOC 2, SSO, perf at scale) | NOT STARTED | post-launch |

## 7. Database schema overview

Tables (`src/lib/db/schema.ts`) — abbreviated:

- `users` — credentials + role + name + state + license info + TOTP + `deletedAt` + `sessionsValidFrom` + `isFoundingSupervisor`.
- `organizations` — Stripe customer / subscription fields + tier + period_end + seatCount.
- `org_memberships` — userId, orgId, role, `deactivatedAt`, **`leave_status`** (active/on_leave/prn) + metadata.
- `supervisor_assignments` — M:N supervisor↔supervisee; primary flag; transferred-from chain.
- `invitations` — hashed-token invites with pending rule + pending supervisor assignment.
- `session_events` — the session log. signatures jsonb, signedAt, scheduledStatus, sign_reminder_sent_at, aiNote, calendar metadata.
- `session_attendees` — group-session participants who all must sign.
- `evidence_packages` — sealed JSON + SHA-256 hash + PDF metadata.
- `supervisee_rule_assignments` — which supervisee follows which rule version.
- `supervisee_rule_attestations` — HR-attested values fed into rule evaluation.
- `notifications` — bell + email notification kinds + read/emailed timestamps.
- `audit_log_entries` — append-only audit trail for all sensitive actions.
- `org_rule_overrides` — cycle 1-7 rule customizations per org (canonical patches + custom rules).
- `rule_source_snapshots` — for cycle 6 version-drift detection.
- `user_calendar_integrations` — encrypted OAuth tokens per user per provider.

Migrations apply via `npx tsx scripts/repair-migrations.ts` (idempotent — sentinel-checked). See `src/lib/db/migrate.ts` for the explanation of why standard `db:migrate` is a no-op.

## 8. Rule engine

A rule lives at `rules/<slug>/v<N>.yaml`. The loader caches everything in a module-level Map. To use a rule:

```ts
import { getRule } from "@/lib/rules/loader";
import { evaluate } from "@/lib/rules/evaluator";

const rule = await getRule("NC", "LCMHCA", 1);
const result = evaluate({ events, assignedAt, leaveStatus }, rule);
// -> { compliant, totals, progress, riskLevel, gaps, paused }
```

The 13 checks (`src/lib/rules/checks.ts`):

1. `pre_registration_required`
2. `supervisor_credential_required`
3. `individual_supervision_cadence` — paused when leaveStatus is on_leave
4. `weekly_supervision_cadence` — paused when leaveStatus is on_leave
5. `supervision_ratio_per_practice_block`
6. `individual_supervision_minimum_share`
7. `group_size_limit`
8. `total_practice_hours`
9. `total_supervision_hours`
10. `duration_window`
11. `permit_expiration_window`
12. `direct_client_contact_minimum`
13. `supervisor_training_course_required`

State-specific edge cases live in each YAML's `notes:` block. Verification triage in `docs/strategy/01-launch-plan.md`.

## 9. Strategy docs (canonical, read in order)

1. `01-launch-plan.md` — GTM, pricing, original tier spec.
2. `02-beta-readiness.md` — beta-launch gap inventory.
3. `03-campaign-execution.md` — campaign sequencing.
4. `04-enterprise-rbac.md` — Enterprise RBAC + multi-supervisor org spec.
5. `05-hris-integration.md` — HRIS rollout (Merge.dev fallback; pivoted 2026-06-24 to Paycor lead).
6. `06-ms-integrations.md` — MS Teams transcript + Outlook Calendar spec.
7. `07-e2e-testing.md`
8. `08-scheduling-and-calendar.md` — Phase 5 scheduling architecture.
9. `09-rules-admin.md` — cycle 1-7 design.
10. `10-freshness-audit.md` — F1-F14 findings + status legend.
11. `11-demo-readiness-test-plan.md` — Phase 6 + Horseman methodology.
12. `12-wave-1-implementation-plan.md` — Wave 1 (shipped 2026-06-19).
13. `13-paycor-integration.md` — Wave 2 + RI integration (current).

Plus `seo-roadmap.md`.

## 10. Brand quick reference

Full detail in `docs/brand/brand-book.md`. Quick lookup:

**Palette** (locked, in `src/app/globals.css` as CSS vars):

- `--foreground` `#0A1428` (deep navy-black)
- `--background` `#FAFAF7` (warm off-white)
- `--evidence-bg` `#F5F1E8` (warm oat — evidence surfaces)
- `--primary` `#0F1F4C` (authoritative navy — nav, primary CTAs)
- `--secondary` `#1D4ED8` (Halo Blue — links)
- `--gold` `#B8860B` (**signet gold** — audit-ready / sealed / verified)
- `--success` `#166534` · `--warning` `#B45309` · `--risk` `#B91C1C`

**Typography**:

- Display: **Cabinet Grotesk** (Fontshare).
- Body: **IBM Plex Sans**.
- Audit/mono: **IBM Plex Mono**.
- Accessible body alternate: **Atkinson Hyperlegible**.

**Voice**: sentence case, verbs first, em-dashes encouraged. Use: audit-ready, evidence package, supervised hours, ratio, obligation, rule version, citation, signature with intent, board-defensible, calm command center. Avoid: crush, slay, magic, journey, holistic, mindful, transform, AI-powered (use *AI-assisted*), seamless, leverage, frictionless.

**Logo**: solid signet-gold annulus with audio-waveform outer edge + sun-dog dot at 22° clockwise from 12 o'clock (atmospheric 22° halo reference). Canonical source `docs/brand/logos/hybrid-solid-a-subtle.svg`. React component `src/components/brand/AuditHaloMark.tsx`.

## 11. Local dev cheat sheet

```pwsh
# from C:\code\audithalo:
npm install                  # one-time
npm run dev                  # http://localhost:3000 (proxy treats localhost as marketing host)

# before every commit:
npm test                     # 420 vitest tests across 37 files
npm run lint                 # eslint
npm run build                # next build (runs validate:rules first)
npm run validate:rules       # state-rules YAML validator

# db:
npm run db:generate                                  # generates a migration from schema diff (often hangs on interactive prompts — use hand-written SQL instead)
npx tsx scripts/repair-migrations.ts                 # idempotent migration applier
npm run db:studio                                    # local DB browser
npm run seed:demo                                    # seed Atlas Counseling Group demo org
```

`.env.local` requirements documented in `.env.example`. Production env vars set in Vercel dashboard.

## 12. Common traps (so you don't re-hit them)

- `js-yaml` parses unquoted `YYYY-MM-DD` as a JS Date. The `dateLike` Zod helper in `src/lib/rules/types.ts` coerces to ISO string.
- A line beginning with a quoted word in YAML breaks the parser.
- `opentype.js` v2 has a NaN bug in `toPathData()` that breaks wordmark glyphs. Pin to v1.3.4.
- The wordmark generator uses a tight mark viewBox; the React component uses a loose viewBox. Do NOT conflate them.
- `@react-pdf/renderer` Route Handlers must declare `runtime = "nodejs"`. Wrap Buffer as `new Uint8Array(buffer)`.
- `drizzle-kit push` and `db:generate` hang in non-TTY. Hand-write SQL + use `repair-migrations.ts` instead.
- `shadcn` CLI `init` also hangs in non-TTY. Wire components manually.
- Next.js 16 deprecated `middleware.ts` — host routing lives in `src/proxy.ts` exporting `function proxy`.
- The Nimbalyst shell may report `cwd` as `C:\nimbalyst\nimbalyst`. The repo is at `C:\code\audithalo`. Use absolute paths.
- **Dev and prod Neon are the same database** as of 2026-06-29. Local mutations affect prod. Split into separate Neon branches before paying customers go live.
- Sign-reminders cron is **paused** as of 2026-06-29 (commit `384341a`). Re-enable by uncommenting the `schedule:` block in `.github/workflows/sign-reminders.yml` once Wave 2 lands or paying users are live.

## 13. What to do first in a new session

1. Read `AGENTS.md` (runtime contract — authoritative).
2. Read this file (orientation).
3. Read `docs/strategy/13-paycor-integration.md` if working on RI / Paycor / Wave 2.
4. `git log --oneline -30` to see recent commits.
5. Check memory in `C:\Users\Caleb\.claude\projects\C--code-audithalo\memory\` for ongoing context (loads automatically).
6. Ask Caleb what's next. Don't assume.
