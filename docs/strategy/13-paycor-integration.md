# Wave 2 — Recovery Innovations + Paycor integration spec

> Written 2026-06-24 by the AuditHalo implementation session for the
> Wave 2 push. Read `AGENTS.md`, then `docs/strategy/12-wave-1-implementation-plan.md`,
> then this doc. Memory at `C:\Users\Caleb\.claude\projects\C--code-audithalo\memory\`
> auto-loads with the RI-specific notes.

## Why this doc exists

Wave 1 (Pass 1-6, shipped 2026-06-18 through 2026-06-19) closed the
demo-readiness gaps and tightened the existing app. Wave 2 builds the
**Recovery Innovations + Paycor integration** that drives the next 6-8
weeks. The lead-customer call (2026-06-17, transcript in chat history,
key citations inline below) produced five aligned decisions that anchor
this spec.

RI hasn't replied to our 2026-06-19 follow-up emails as of writing
(2026-06-24). This doc is the **execution plan for everything we can
do without waiting on RI's reply**, plus a clean phasing for the rest.

## State of the world (as of 2026-06-24)

- Wave 1 fully shipped through commit `09506e8` — 8 commits, 308 tests,
  no regressions outstanding.
- RI follow-up emails drafted but not yet sent — see
  `docs/emails/2026-06-19-ri-paycor-followups.md` for current copy.
- Matt + Nick (Medipyxis executive developers) flagged as the
  auto-provisioning experts on the call; their reply unblocks 2B.
- No Paycor partner contact established yet; partner-support email
  goes out after RI confirms which Paycor account / admin we route
  through.
- Lifecycle one-pager (Wave 1 Pass 7) was deferred until RI signed
  off the one-pager — now consolidated into the email draft in this
  bundle.

## The five RI decisions (transcript-grounded)

Source: 2026-06-17 call transcript. Citations are line numbers from
the transcript file Caleb pasted on 2026-06-19.

1. **AI-driven transcription workflow → templates → supervisor review**
   (transcript lines 124-141). The supervisor's "create the note" step
   disappears entirely: in-app meeting recording → AI transcribes →
   AI fills the supervision template → supervisor reviews + signs.
   ~5-minute processing lag tops. Rollout plan: 1 team for 2 weeks
   first, then org-wide.

2. **Automated state-regulation + Joint Commission overlay**
   (transcript lines 161-187). State-rule auto-update via cron with
   HR-Admin one-click confirmation is the same pattern. JC standards
   are mostly handled today by the existing customizable rule
   overrides (`/dashboard/team/rules/...`); what's new is **a JC
   fetcher in the same cron pattern** so updates surface
   automatically.

3. **Signed PDFs land DIRECTLY in Paycor per-employee Documents
   folders**, not external links (transcript lines 197-225,
   especially Joy Brunson-Nsubuga's "we need the document in payor"
   at line 222). RI explicitly rejected a "summary in custom field +
   link to AuditHalo" pattern.

4. **SFTP, not REST, for the PDF document transfer** (transcript
   lines 244-247, Alicia Long confirming: "standard API doesn't work
   to get the document into the folder. It would have to be an SFTP
   ... Payor struggles getting an entire PDF into the documents
   folder, but they said it may be possible with an SFTP").

5. **Real-time Paycor↔AuditHalo roster sync** replaces the
   nightly-CSV mental model in `docs/strategy/05-hris-integration.md`
   (transcript lines 320-401). RI hires in waves (~biweekly classes,
   daily attrition) plus has on-leave + PRN status complications
   that the existing CSV model doesn't cover.

## Phasing

### Phase 0 — Planning (this doc)

In our hands. Deliverables:

- This spec doc (`docs/strategy/13-paycor-integration.md`)
- Pivot of `docs/strategy/05-hris-integration.md` from Merge.dev to
  Paycor as the lead path (Merge.dev stays the fallback for non-RI
  Enterprise customers)
- Refreshed `project_ri_customer.md` memory with transcript-grounded
  specifics
- `docs/emails/2026-06-19-ri-paycor-followups.md` with three email
  drafts (RI thread / Matt+Nick internal / Paycor partner support)

### Phase 1 — Internal foundation (in our hands, can start now)

No external blockers. Order within the phase matters — foundational
work first.

| # | Workstream | Why this order |
|---|---|---|
| 1.1 | **2A Lifecycle state expansion** (schema + rule-engine pause + team-page UI) | Everything downstream needs to know whether a clinician is `active` / `on_leave` / `prn`. Default behavior (manual HR Admin flip) is safe from the transcript; the bring-back path is the only open Q and we default to manual. |
| 1.2 | **2F state-rules auto-update cron (state half only)** | We own `rules/` + `source_hash` per `ruleVerificationSchema`. The diff + HR Admin confirm UI is straight code. JC half is gated on Tricia. |
| 1.3 | **HR Admin "Paycor sync" dashboard panel (empty state)** | Renders "Paycor not connected yet" until Phase 3 lights it up. Gets the surface in place so 2C/2D have a destination. |
| 1.4 | **2C abstraction layer** — normalized `PaycorChange` type + `applyPaycorChange()` with a mock provider | Lets us write tests + shape the API without needing Paycor access. Real provider plugs in during Phase 3. |

Each phase-1 item ships with vitest coverage, a tight PR, and the
identity flags per `docs/PUSHING.md`. AGENTS.md prod-DB gate applies
to 1.1 and 1.3 migrations — show the SQL, get "yes," then run.

### Phase 2 — Scaffolding (still no external blockers; more speculative)

Risk: writing code that turns out to be wrong because we haven't
heard back. Probably do these AFTER initial RI replies arrive, even
if the replies are partial. Each ships as a mock / stub.

| # | Workstream | What ships |
|---|---|---|
| 2.1 | **2D SFTP worker skeleton** | Vercel Queue + retry/backoff + failure → audit log → dashboard alert. Destination is a mock writer until Paycor creds arrive. |
| 2.2 | **2E PDF template variant scaffolding** | `organizations.pdfTemplateKey` enum + conditional render path. Only `'audithalo_generic'` available until RI sends template. |
| 2.3 | **2B auto-provisioning shell** | Calls `commitHrisImportAction` from a Paycor-shaped input. Reuses 2C's abstraction layer. Waits on Matt+Nick. |

### Phase 3 — Unblocked by email replies

Each line maps 1:1 to an external dependency. Drop-in work, fast
once unblocked.

| Workstream | Waiting on |
|---|---|
| 2B real auto-provisioning logic | Matt+Nick reply |
| 2C real Paycor credentials | RI's Paycor admin contact + AppCreator OAuth client + APIM subscription key |
| 2D real SFTP destination | Paycor SFTP partner spec (separate from Public API) + creds + folder path |
| 2E RI template render variant | RI template file |
| 2F JC half | Tricia's standards source list |
| PRN tracking signal | RI/Bree — how PRN is identified in Paycor today (custom field? job code? employment type?) — Paycor's `EmploymentStatus` enum has no "PRN" value |

### Phase 4 — Post-Paycor-live

| Workstream | Trigger |
|---|---|
| 3G AI transcription + note workflow | Recall.ai (or equivalent) vendor pick; RI pilot team confirmed |
| 3H AI performance review summaries | 2D + 2E live; RI review-period boundary confirmed |
| 3I Post-seal correction flow | RI raises it (currently doc-debt, not Wave 2/3 gating) |

## Confirmed Paycor API specs (from swagger 2026-06-29)

Source: Paycor Public API v1 + v2 OpenAPI 3.0 specs (NSwag-generated)
that Caleb downloaded from Paycor's developer portal. These supersede
the assumptions in earlier drafts of this doc.

| Spec | Value | Source |
|---|---|---|
| Server | `https://apis.paycor.com` | both swaggers, line 11 |
| Auth | Two-layer: APIM Subscription Key (header `Ocp-Apim-Subscription-Key`) + OAuth Bearer token in `Authorization` header. Both required. | v1 intro |
| Rate limit | 1000 API calls per minute, total across all Paycor APIs, per customer subscription key | v1 intro |
| Retry policy | GETs safe to retry. **Do NOT retry POST/PUT on 500** — risks double-posting | v1 intro |
| Webhooks | **None.** No webhook subscription endpoints in either v1 or v2. Polling-only architecture is the only option — matches Bree's daily-COB choice. | absence in both swaggers |
| Document push | **No general document upload endpoint** in either v1 or v2. Only pay-stub READ endpoints (`/v1/employees/{employeeId}/PayStubDocument/{documentId}`). Confirms Alicia's call statement that PDF push requires SFTP, not REST. | v1 line 2773 |
| IDs | `ClientId = LegalEntityId`, `TenantId = CompanyId`, `EmployeeId` is API-only (not visible in Paycor UI) | v1 intro |

**Endpoints AuditHalo will consume** (Phase 3 — real sync):

| Endpoint | Use |
|---|---|
| `GET /v1/legalentities/{legalEntityId}/employees` | Daily polling — list all employees for RI's legal entity. v2 alternative at `/v2/legalentities/{legalEntityId}/employees`. |
| `GET /v1/employees/{employeeId}/positionandstatus` | Per-employee status + position detail when needed |
| `GET /v1/employees/{employeeId}/status` | Current employment status |
| `GET /v1/employees/{employeeId}/customfields` | Read the AuditHalo-role + (potentially) PRN custom field values |
| `GET /v1/legalentities/{legalEntityId}/customfields` | Discover what custom fields RI defined |
| `GET /v1/employees/{employeeId}/timeoffrequests` | On-demand: fetch period data for accurate "exclude leave" audit reconstruction. Constraint: start/end within 1 year, max 90-day window per call. |

**Paycor's `EmploymentStatus` enum** (v1 swagger schema line 27258):

```
Active, Deceased, LongTermDisability, ShortTermDisability,
Fmla, LaidOff, LeaveWithPay, LeaveWithoutPay, ThirdPartyPayable,
Resigned, Retired, Terminated, WorkersCompensation
```

**Mapping into AuditHalo's `leaveStatus` + `deactivatedAt`**:

| Paycor `EmploymentStatus` | AuditHalo result |
|---|---|
| `Active` | `leaveStatus = 'active'` (+ optional PRN derived from custom field — see open Q) |
| `LongTermDisability` | `leaveStatus = 'on_leave'` |
| `ShortTermDisability` | `leaveStatus = 'on_leave'` |
| `Fmla` | `leaveStatus = 'on_leave'` |
| `LeaveWithPay` | `leaveStatus = 'on_leave'` |
| `LeaveWithoutPay` | `leaveStatus = 'on_leave'` |
| `WorkersCompensation` | `leaveStatus = 'on_leave'` |
| `ThirdPartyPayable` | `leaveStatus = 'on_leave'` (rare, defensive default) |
| `LaidOff` / `Resigned` / `Retired` / `Terminated` / `Deceased` | `deactivatedAt = NOW()` on `org_memberships`; lifecycle row leaves AuditHalo's "active roster" entirely |

PRN is not in Paycor's status enum — needs a separate signal (custom
field or employment-type field). Open question for next email round.

**Still missing — not in Public API docs:**

- Paycor SFTP partner spec (separate channel, separate creds)
- AppCreator onboarding flow for AuditHalo's OAuth client + APIM key
- Sandbox / test account access for development without writing real RI data

These come through Paycor partner support once RI's Paycor admin
loops us in.

## Per-workstream spec

### 2A — Lifecycle state expansion

**Schema additions** (`src/lib/db/schema.ts`):

```ts
export const LEAVE_STATUS = ["active", "on_leave", "prn"] as const;

// on org_memberships:
leaveStatus: text("leave_status", { enum: LEAVE_STATUS }).notNull().default("active"),
leaveStatusChangedAt: timestamp("leave_status_changed_at", { withTimezone: true }),
leaveStatusChangedByUserId: uuid("leave_status_changed_by_user_id")
  .references(() => users.id),
leaveStatusSource: text("leave_status_source"), // 'manual_hr_admin' | 'paycor_sync'
```

**Migration**: numbered SQL under `drizzle/`, zero-downtime (adds
column with `'active'` default; backfills implicit). Show SQL via
`db:generate` and confirm with Caleb before running against prod
Neon (AGENTS.md gate).

**Rule engine** (`src/lib/rules/evaluation-context.ts`): pause
obligation timers when `leaveStatus === 'on_leave'`. Cleanest seam:
filter the events array to exclude rows whose date falls between
the most-recent `on_leave` start and the most-recent `active` flip.
PRN has NO rule-engine effect — they accrue when they work.

**Notification suppression** (locked 2026-06-25 per Bree's reply):
- Sign-reminders cron skips supervisees whose `leaveStatus === 'on_leave'`
- "Needs supervision this week" widget filters out only `on_leave`
- **PRN supervisees DO continue receiving reminders.** Bree wants
  "needs supervision" prompts to persist for PRN even if they may
  not work that week — the supervision can happen on the next shift
  they pick up. PRN is functionally identical to `active` for
  notifications; only the badge differs.

**Source of truth = Paycor** (locked 2026-06-25 per Bree). All
lifecycle state transitions originate in Paycor; AuditHalo reflects
on the next sync (Phase 3). Return-to-active is automatic when
Paycor flips back — no HR Admin confirmation step in AuditHalo. RI
admins are the only ones who change it in Paycor, so the source is
trusted.

**Team-page UI**: read-only badge in the Supervisees table showing
current `leaveStatus` + "synced from Paycor" indicator. **No manual
flip from AuditHalo in v1** — since Paycor is source of truth, a
manual override here would be overwritten on the next sync and
confuse HR Admin. Revisit if a customer asks for AuditHalo-side
flip later.

**Audit log**: `LEAVE_STATUS_CHANGED` action with old → new + source
(`paycor_sync`) in details.

**Tests**: pure unit tests on the rule-engine pause logic. Assert
that PRN does NOT suppress reminders (regression-pin for the
2026-06-25 Bree clarification).

### 2B — Auto-provisioning

Service module `src/lib/hris/paycor-sync.ts` with one entry point:

```ts
type PaycorChange =
  | { kind: 'employee_hired'; employee: PaycorEmployee }
  | { kind: 'employee_terminated'; employeeId: string; terminatedAt: Date }
  | { kind: 'leave_status_changed'; employeeId: string; status: LeaveStatus; effectiveAt: Date }
  | { kind: 'role_changed'; employeeId: string; auditHaloRole: OrgRole };

async function applyPaycorChange(orgId: string, change: PaycorChange): Promise<SyncResult>;
```

Reuses `commitHrisImportAction` from `src/app/actions/hris-import.ts`
for the create path (seat caps + invite email already covered).

**Role resolution from Paycor custom field**: map `paycorEmployee.customFields.auditHaloRole`
to our `org_memberships.role` enum. Fail loudly on unknown values,
write to audit log, alert HR Admin.

**Supervisor assignment**: open. Two patterns to choose between
once Matt+Nick reply:
- (a) Auto-assign from Paycor's `managerId`. Simple, possibly wrong
  (HR manager ≠ clinical supervisor at RI).
- (b) Leave `pendingAssignmentSupervisorId` null and surface "N new
  clinicians need supervisor assignment" notification to HR Admin
  daily.

### 2C — Paycor sync (daily polling)

**Architecture locked 2026-06-25**: Bree said "close of business
daily would work fine from my perspective." That answers the
real-time question — **we do NOT need webhooks for v1**. A single
daily cron job at COB Eastern is sufficient.

Caveat: Bree noted "others can weigh in here" — if Alicia or
Joy comes back wanting stricter, we'd revisit. For now we ship the
simple version.

| Architecture | Latency | When we'd use it |
|---|---|---|
| **Daily cron at COB** | up to 24 hr | **v1 default** per Bree |
| Polling every 5-15 min | minutes | If a future customer needs intra-day freshness |
| Direct Paycor webhooks | sub-minute | If a future customer needs near-real-time |

**Implementation**: same pattern as `sign-reminders.yml` GitHub
Actions cron (or Vercel Cron once we're on a paid plan that allows
intra-day intervals). Single endpoint:

- `POST /api/cron/paycor-sync` — Cron-Secret gated, daily at 18:00
  ET (after RI's COB)

No webhook endpoint needed in v1. No Vercel Queues needed for this
channel (the queue is still used for 2D SFTP delivery, which is
event-driven on session seal — separate concern).

**Fields synced FROM Paycor**:
- Employment status (active / terminated)
- Last paycheck date (Damon's secondary deactivation signal,
  transcript line 360)
- Custom field: AuditHalo role (added by RI Paycor admin)
- Custom field: on_leave flag (Paycor is source of truth — see 2A)
- Manager reference (for 2B supervisor-assignment hint)

**Nothing flows back TO Paycor on this channel** — the PDF push
in 2D is the only outbound, and that's SFTP not API.

### 2D — SFTP delivery for sealed PDFs

**Trigger**: existing `SESSION_SEALED` audit event fires on seal
(Pass 4 work confirmed this). Post-seal handler enqueues the
delivery.

**Worker pattern**: Vercel Functions can't hold long-lived SFTP
sessions cleanly inside the 300s budget when multiple files queue.
Use **Vercel Queues** (public beta per knowledge-update hook).

```
on session_sealed:
  enqueue PaycorDeliveryJob { orgId, sessionId, paycorEmployeeId, pdfUrl }

queue worker:
  group by orgId
  open one SFTP session per org
  push all queued PDFs in that session
  per-file retry up to 3x with exponential backoff
  after 3 failures: audit log + HR Admin notification
```

**Library**: `ssh2-sftp-client` (well-maintained, supports key-pair +
password auth). Env vars per org:
- `PAYCOR_SFTP_HOST_<orgId>` — or single shared host if Paycor pools
- `PAYCOR_SFTP_USER_<orgId>`
- `PAYCOR_SFTP_PRIVATE_KEY_<orgId>` (or `_PASSWORD_<orgId>`)
- `PAYCOR_SFTP_BASE_PATH_<orgId>`

Per-org credential storage in `organizations.paycorConfig` JSONB,
encrypted at rest. Open Q for partner support: one creds set per
customer, or shared / multi-tenant?

**Filename convention** (Damon's date-based suggestion, transcript
line 274-275):

```
{YYYY-MM-DD}_supervision_{superviseeLastName}_{superviseeFirstName}_{ruleVersion}.pdf
```

Rule version included so auditors know which rule the session was
sealed under. Open Q for RI: confirm shape.

**Path under employee profile**: per transcript line 256, "under
their personal profile under documents." Needs partner-support
confirmation of actual SFTP path — likely either
`{employeeId}/documents/` or `documents/{employeeId}/`.

**Dashboard surface**: new "Paycor sync" card on HR Admin dashboard
showing recent deliveries + failures. Live, since auditors may show
up unannounced (Joy at transcript line 224: "we don't get advance
notice the majority of the time and it happens, I don't know,
Trisha, every quarter there's a good five").

### 2E — PDF template wiring

`src/components/pdf/EvidencePdf.tsx` already exists and renders a
generic template. Add a template-variant prop and ship a
`RecoveryInnovationsTemplate` variant once RI sends their template.

Schema: `organizations.pdfTemplateKey` enum, default
`'audithalo_generic'`, RI orgs get `'recovery_innovations_v1'`.

Conditional render path branches on the key. Render-time tests
verify each template doesn't drop required fields.

**Open**: do we expose this as configurable for any Enterprise
customer, or keep RI-only at first? Recommend RI-only initially —
simpler, no admin UI, revisit when a second Enterprise asks.

### 2F — State-rule + JC auto-update cron

State rules already validated nightly via `scripts/validate-rules.ts`
on `prebuild`. The NEW piece is **automated detection of upstream
changes + HR Admin notification flow**.

**For state rules**: scrape each rule's `citation.url` weekly. Hash
the relevant content (we already track `source_hash` per
`ruleVerificationSchema`). On change, queue a notification:
"NC LCMHCA rule may have updated — review and confirm."

**For JC standards**: same pattern. **The source URLs are the gap**
— Tricia needs to hand over which JC standards documents she audits
against (transcript lines 184-185 confirms she's the SME).

**Confirmation UI**: HR Admin sees "Rule update available" banner →
clicks → diff view comparing old vs new content (we already have
`src/lib/rules/diff.ts`) → one-click "Apply update" creates a new
rule version + a notification to every supervisee on that rule.

**Cron schedule**: weekly is fine. `.github/workflows/rules-update.yml`,
same pattern as `sign-reminders.yml`.

### 3G — AI transcription + note workflow

The biggest new lift. **Audio capture is the unsolved piece** — we
already have the transcript-to-note path tightened in Pass 4
(`src/app/actions/ai-note.ts`).

Three capture options:

| Option | Pros | Cons |
|---|---|---|
| **Recall.ai bot-as-attendee** | Industry-standard. Joins Meet/Teams as participant. ~$0.10/min. | Vendor dependency. Bot visible in meeting. |
| **Native Meet/Teams APIs** with recording permission | Already have OAuth. Audio stays in our stack. | Heavier compliance lift — recording + retention disclosures, per-platform code. |
| **Browser-based capture** during meeting | Lowest vendor cost. | Quality issues. Breaks if user closes tab. |

**Recommendation**: (a) Recall.ai for v1, swap to (b) if RI wants
the audio kept inside our stack. `MEETING_RECORDING_PROVIDER` env
var so we can switch later.

**Workflow**:
1. Pre-meeting: scheduling action creates a recording-bot link,
   attaches to calendar invite metadata
2. Meeting: bot joins, captures
3. Post-meeting (≤5 min): transcript + AI-generated note land on
   `/sign/{sessionId}`
4. Supervisor reviews + edits + signs (existing flow)
5. Seal → SFTP-to-Paycor pipeline (2D) takes over

**1-team-for-2-weeks rollout** (Damon's commitment, transcript line
130-132): feature flag — `organizations.aiTranscriptionEnabled`
boolean, default false, flip per-team manually for first 2 weeks.

### 3H — AI performance review summaries

After 2D ships, this is mostly composition:

- Cron-job aggregates signed sessions per supervisee per review
  period
- LLM call summarizes themes, growth areas, concerns
- Renders to PDF using same template channel as 2E
- Reviewer (assigned supervisor) sees draft in dedicated UI →
  confirms or edits → signs off
- Goes to Paycor Documents via 2D's channel with distinct filename
  prefix:
  ```
  performance_review_{YYYY-Q}_{superviseeLastName}_{superviseeFirstName}.pdf
  ```

**Legal disclaimer** baked into the PDF footer + the
supervisor-sign-off step has acknowledgment text. Memory note on
legal exposure stays load-bearing.

**Open**: review-period boundary. Calendar quarter? Anniversary date
from Paycor? Bree mentioned RI's existing "one-to-one tool" usage
(transcript lines 305-307) — that cadence is probably the answer.

## Migration ordering

Phase 1 introduces three schema migrations. Generated in order via
`npm run db:generate`, applied via `db:push` only after Caleb's
"yes."

1. `00XX_leave_status.sql` — `org_memberships.leave_status` enum +
   metadata columns (2A)
2. `00XY_paycor_config.sql` — `organizations.paycorConfig` JSONB
   (1.3, 2D)
3. `00XZ_pdf_template_key.sql` — `organizations.pdfTemplateKey`
   enum (2E)

All three are additive, zero-downtime, no backfill required.

## Open questions inventory

Grouped by who needs to answer. Each blocks a specific workstream.
Bree's 2026-06-25 reply closed three lines (lifecycle semantics +
return-to-active + real-time SLA). Remaining:

**RI (shared email thread)**:

- (2E) PDF template file — Bree / Alicia
- (2D, 2A) Paycor admin contact — Alicia
- (2F) JC standards source documents — Tricia
- (3H) Review-period boundary for AI performance summaries —
  not blocking, ask later
- (3G) Pilot team for AI transcription rollout — not blocking,
  ask later
- Optional: confirm stricter sync SLA isn't needed from Alicia /
  Joy (Bree noted others can weigh in; daily-COB is our default
  until they object)

**Matt + Nick (Medipyxis)** — senior devs, NOT Paycor specialists:

- Spec review on `docs/strategy/13-paycor-integration.md` for
  fresh-eyes critique (schema, phasing, missed edges)
- Code review on Wave 2 PRs as they land
- General patterns they've shipped for: idempotent daily-cron
  syncs against external APIs, SFTP file delivery with retry +
  failure surfacing, audit-log shapes for external-sync events
- No expectation of Paycor-specific knowledge

(Webhook-vs-polling question retired — Bree's daily-COB answer
matches Paycor's webhook-less Public API per the swagger.)

**Paycor partner support** (sent after RI confirms account contact):

- (2D) SFTP host + auth + file size + connection cap
- (2D) Documents folder path convention
- (2D) Post-upload tagging API
- (2C) Polling-only API endpoints for employee data + their rate
  limits (we're not using webhooks per Bree)
- (2A) Custom field setup via API or UI only

## References

- Wave 1 plan: `docs/strategy/12-wave-1-implementation-plan.md`
- HRIS doc (pivots after this lands): `docs/strategy/05-hris-integration.md`
- Scheduling + calendar (provides Meet/Teams hookup for 3G):
  `docs/strategy/08-scheduling-and-calendar.md`
- Rules admin (covers JC overlay base):
  `docs/strategy/09-rules-admin.md`
- 4-Horsemen review methodology: `docs/developers.md`
- Pushing to main: `docs/PUSHING.md`
- Email drafts: `docs/emails/2026-06-19-ri-paycor-followups.md`
- Memory: `project_ri_customer.md`

## Suggested first action after Phase 0 lands

Start **1.1 — 2A Lifecycle state expansion** with **Option A locked**
(2026-06-29, after reading the Paycor swagger).

**Why Option A wins given the Paycor docs:**

- Paycor's `timeoffrequests` endpoint returns the period data
  (start/end) on demand, so Paycor canonically holds the historical
  audit trail.
- Local `leave_periods` history (Option B) would be a cache that
  drifts from Paycor's truth and adds schema complexity for no real
  benefit.
- For accurate "exclude-leave" audit reconstruction, we call
  Paycor's `timeoffrequests` live (same auth scope as our other
  Paycor reads, capped at 90-day windows per the API constraints).

Bree's 2026-06-25 reply locked the behavior:

- `on_leave` → pause timers + stop reminders
- `prn` → no behavior change vs `active`, badge only
- Return-to-active → automatic on next sync (no manual confirm step)
- Source of truth → Paycor; AuditHalo reflects, doesn't write back
- No manual flip in AuditHalo UI for v1 (would be overwritten next
  sync anyway)

Generate the migration, show the SQL to Caleb, get "yes," apply
against dev Neon, ship vitest coverage, push.

## Pricing note — RI is a custom plan

Standard Solo tier caps AI notes at 10/month (`src/lib/billing/seats.ts`).
**RI is not on the standard Practice tier** — they're paying a custom
upfront commission for the build, with their own quota model
(currently undefined; revisit when full pricing is locked
post-launch). 3G/3H AI quotas for RI bypass the standard caps.
The `aiNoteQuotaBlockedReason` check should special-case RI's
billing identity or be gated behind a `unlimited_ai_notes` feature
flag on `organizations`.
