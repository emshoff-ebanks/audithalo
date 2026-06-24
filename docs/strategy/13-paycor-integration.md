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
| 2C webhook vs polling architecture decision | RI's real-time SLA + Paycor partner reply |
| 2D real SFTP destination | Paycor partner reply (creds + folder path) |
| 2E RI template render variant | RI template file |
| 2F JC half | Tricia's standards source list |

### Phase 4 — Post-Paycor-live

| Workstream | Trigger |
|---|---|
| 3G AI transcription + note workflow | Recall.ai (or equivalent) vendor pick; RI pilot team confirmed |
| 3H AI performance review summaries | 2D + 2E live; RI review-period boundary confirmed |
| 3I Post-seal correction flow | RI raises it (currently doc-debt, not Wave 2/3 gating) |

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

**Notification suppression**:
- Sign-reminders cron skips supervisees whose `leaveStatus === 'on_leave'`
- "Needs supervision this week" widget filters them out
- PRN clinicians stay tracked but get a soft "PRN" badge

**Audit log**: `LEAVE_STATUS_CHANGED` action with old → new + source
in details.

**Team-page UI**: leave-status dropdown next to the deactivate button
in the Supervisees table. HR Admin only. Badge ("Synced from Paycor"
vs "Manual override") so HR Admin knows whether a manual flip will
be overwritten by the next sync (Phase 3).

**Tests**: pure unit tests on the rule-engine pause logic. RBAC test
that supervisor / supervisee can't change status.

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

### 2C — Paycor real-time sync

Two architectures to choose between (decision needs RI's real-time
SLA + Paycor partner confirmation):

| Architecture | Latency | Cost | Risk |
|---|---|---|---|
| Direct Paycor webhooks | sub-minute | low — stand up endpoint | depends on Paycor exposing webhooks |
| Polling every N minutes | 5-15 min | moderate — cron + dedup | rate limits; missed flips between polls |

If Paycor doesn't expose webhooks, polling is the only option.
Cap "real-time" at "under 10 minutes" in that case.

**Fields synced FROM Paycor**:
- Employment status (active / terminated)
- Last paycheck date (Damon's secondary deactivation signal,
  transcript line 360)
- Custom field: AuditHalo role (added by RI Paycor admin)
- Custom field: on_leave flag
- Manager reference (for 2B supervisor-assignment hint)

**Nothing flows back TO Paycor on this channel** — the PDF push
in 2D is the only outbound, and that's SFTP not API.

**Endpoint shape**:
- `POST /api/integrations/paycor/webhook` — webhook variant, HMAC
  signature verified
- `GET /api/cron/paycor-sync` — poll variant, Cron-Secret gated

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

**RI (shared email thread)**:

- (2E) PDF template file
- (2A, 2C) On-leave / PRN / return-to-active semantics in AuditHalo
- (2C) Real-time SLA target in minutes
- (2F) JC standards source documents from Tricia
- (3H) Review-period boundary for AI performance summaries
- (3G) Pilot team for AI transcription rollout

**Matt + Nick (Medipyxis)**:

- (2B) Event payload shape from prior Paycor work
- (2B) Manager vs clinical-supervisor distinction handling
- (2B) Idempotency + retry model
- (2C) Webhook vs polling experience + Paycor rate limits
- (2D) SSH key-pair management pattern they used

**Paycor partner support** (sent after RI confirms account contact):

- (2D) SFTP host + auth + file size + connection cap
- (2D) Documents folder path convention
- (2D) Post-upload tagging API
- (2C) Webhook capability or polling-only
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

Start **1.1 — 2A Lifecycle state expansion**. Schema + rule-engine
pause + team-page UI. Generate the migration, show the SQL to Caleb,
get "yes," apply against dev Neon, ship vitest coverage, push.
