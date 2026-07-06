# Wave 2 Phase 2 — Paycor Integration Scaffolding

> Written 2026-07-06. Read `AGENTS.md` first, then `docs/strategy/13-paycor-integration.md`
> (the master Wave 2 spec), then this doc. Memory auto-loads.

## Why this doc exists

Wave 2 / 2E (RI Clinical Supervision Form PDF) shipped 2026-07-06.
The next step is building the infrastructure that connects AuditHalo
to Paycor — but RI hasn't provided Paycor API credentials or SFTP
specs yet. This plan covers everything we CAN build without those
credentials, using mock providers that swap for real ones when creds
arrive.

## How AuditHalo works today (context for the new session)

A supervisor at RI oversees clinicians. Today's workflow:

1. **HR Admin** manually invites each clinician to AuditHalo. Types
   their name, email, role — one at a time.
2. **Supervisor** schedules or logs supervision sessions with their
   assigned supervisees.
3. After a session, the supervisor goes to `/sign/{sessionId}` and:
   - (Optional) Pastes a transcript → AI generates a structured note
   - (RI only) Fills out the Clinical Supervision Form sections
     (competency checkboxes, action steps, case review, etc.)
   - Signs with intent confirmation
4. **Supervisee** opens the same `/sign/{sessionId}` page and signs.
5. Both signatures trigger **seal** → evidence package generated
   (canonical JSON + SHA-256 hash) → PDF available for download.
6. HR Admin or supervisor manually downloads the PDF and... does
   what with it? Today, nothing automated. They could email it,
   print it, or save it to a shared drive. **The gap is getting it
   into Paycor's employee Documents folder automatically.**

### What this phase changes from the human's perspective

**For the HR Admin (Bree at RI):**
- Today: manually adds/removes people from AuditHalo when they
  hire, fire, or put someone on leave. Downloads PDFs and
  manually files them.
- After Phase 2: AuditHalo shows a "Paycor Integration" panel
  on her dashboard. Initially it says "Not connected." Once RI
  provides credentials (Phase 3), it becomes a live dashboard
  showing last sync time, recent deliveries, and any failures.
  She no longer manually manages the roster or files PDFs — both
  happen automatically.

**For the Supervisor (Dr. Sarah Chen at RI):**
- Today: fills out the clinical form, signs, and the session is
  sealed. The PDF sits in AuditHalo.
- After Phase 2: same workflow — but after seal, the PDF is
  automatically queued for delivery to Paycor. The supervisor
  doesn't need to do anything differently. They might see a
  "Delivered to Paycor" badge on the sealed session eventually,
  but v1 doesn't surface that to them.

**For the Supervisee (Jordan Williams at RI):**
- No change. They sign when asked. They don't interact with
  Paycor integration at all.

**For non-RI orgs (Atlas Counseling, future customers):**
- Zero change. The Paycor integration is per-org. Orgs without
  `paycorConfig` set see nothing different. The daily sync cron
  skips them. The SFTP delivery hook doesn't fire for them.

### Side effects on existing features

| Existing feature | Impact |
|---|---|
| **Roster page (`/dashboard/roster`)** | New employees auto-provisioned from Paycor will appear here automatically. HR Admin no longer needs to manually invite them. Existing manual invitation flow still works — Paycor sync doesn't break it, just makes it unnecessary for Paycor-connected orgs. |
| **Supervisor assignment** | Auto-provisioned employees arrive WITHOUT a supervisor assignment. HR Admin sees "N unassigned supervisees" notification and assigns them manually. This is intentional — Paycor's `managerId` is the HR manager, not the clinical supervisor. |
| **Leave status badges** | Currently set by the seed data or manually. After daily sync, these update automatically from Paycor's `EmploymentStatus` enum. The team page and supervisor dashboard reflect the change on the next page load. |
| **Sign-reminders cron** | Already skips `on_leave` supervisees (built in Phase 1.1). No change needed — the daily sync feeds the same `leaveStatus` column. |
| **Rule-engine evaluation** | Already pauses obligation timers for `on_leave` (built in Phase 1.1). No change needed. |
| **Evidence package generation** | Modified: adds a post-generation hook that queues SFTP delivery if `paycorConfig` exists. Sealed sessions for non-Paycor orgs are completely unaffected. |
| **Audit log** | New action codes (`paycor_sync.employee_hired`, `paycor_sync.employee_terminated`, `paycor_sync.leave_changed`, `paycor_sync.delivery_queued`, `paycor_sync.delivery_completed`, `paycor_sync.delivery_failed`). HR Admin sees these in the audit log timeline. |
| **Billing / seat count** | Auto-provisioned employees consume seats. If the org hits their Practice tier seat cap, the sync logs the failure and notifies HR Admin — it does NOT silently drop the employee. |

### Edge cases a human would encounter

| Scenario | What happens | Is this confusing? |
|---|---|---|
| Employee terminated in Paycor but has a pending unsigned session in AuditHalo | Employee is soft-deactivated in AuditHalo. The pending session stays — it's historical record. But the supervisee can no longer sign in. Supervisor should be notified: "Jordan Williams was deactivated — 1 unsigned session remains." | Could be confusing without notification. **Pass 2 must surface this.** |
| Employee on leave in Paycor, comes back to active | Next daily sync flips `leaveStatus` back to `active`. Sign reminders resume. No manual step in AuditHalo. | Clear — matches Bree's expectation (confirmed 2026-06-25). |
| New hire in Paycor, AuditHalo seat cap reached | Sync logs the failure. HR Admin sees "1 employee could not be provisioned — seat limit reached. Upgrade your plan or contact support." | Clear if we show the right message. |
| Sealed PDF fails SFTP delivery 3 times | Delivery marked `failed`. HR Admin notification: "Supervision form for Jordan Williams (2026-07-03) could not be delivered to Paycor. Retry or download manually." Dashboard shows the failure with a retry button. | Clear. |
| HR Admin manually invites someone who's already in Paycor | The daily sync should recognize the match (by email) and NOT create a duplicate. It links the existing AuditHalo user to the Paycor employee ID instead. | Could cause duplicates if not handled. **Pass 2 must deduplicate by email.** |
| Paycor API is down during daily sync | Sync retries once. If still down, logs the failure and notifies HR Admin. Next day's sync picks up the delta. | Clear if notification explains it was a Paycor issue, not AuditHalo. |

### How this fits into the bigger product picture

```
┌───────────────────────────────────────────────────────┐
│                    PAYCOR (HRIS)                      │
│  Source of truth for: roster, employment status,      │
│  job titles, credentials, leave/PRN status            │
└────────────────────────┬──────────────────────────────┘
                         │
              Daily sync (2C) ↓ polls    ↑ SFTP push (2D)
                         │               │
┌────────────────────────┴───────────────┴──────────────┐
│                   AUDITHALO                           │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Roster      │  │ Supervision  │  │ Evidence     │ │
│  │ Management  │←─│ Sessions     │──│ Packages     │ │
│  │ (auto from  │  │ (sign flow)  │  │ (sealed PDF) │ │
│  │  Paycor)    │  │              │  │              │ │
│  └─────────────┘  └──────────────┘  └──────┬───────┘ │
│                                            │         │
│  ┌─────────────┐  ┌──────────────┐         │ auto    │
│  │ Rule Engine │  │ Clinical     │         │ deliver │
│  │ (state +    │  │ Form (RI     │         │ to      │
│  │  JC rules)  │  │ template)    │         │ Paycor  │
│  └─────────────┘  └──────────────┘         ↓         │
│                                    SFTP to Paycor     │
│                                    Documents folder   │
└───────────────────────────────────────────────────────┘
```

The Paycor integration makes AuditHalo a **closed loop**: roster
comes IN from Paycor, supervision documentation goes OUT to Paycor.
No manual data entry, no manual file management. This is the core
value prop for RI and the reason they're paying for the build.

## What's done (don't redo)

- Wave 1 Passes 1-6 (all shipped 2026-06-19)
- Wave 2 Phase 0 (planning docs, email drafts, Paycor swagger grounding)
- Wave 2 Phase 1.1 (leave_status on org_memberships + rule-engine pause)
- Wave 2 Phase 1.2 (state-rules source-drift cron)
- **Wave 2 / 2E (RI Clinical Supervision Form PDF)** — schema
  (`pdfTemplateKey`, `supervisionType`, `clinicalFormData`), sign-page
  clinical form UI (accordion sections I-VI), `RiClinicalSupervisionPdf.tsx`
  with RI logo + purple branding, API route branching, evidence package
  integration, Zod validation on save action, E2E Playwright specs,
  441 tests passing.
- Migration 0030 applied to prod DB.
- RI test org seeded: "Recovery Innovations Test" with 3 accounts
  (Bree Martinez HR Admin, Dr. Sarah Chen Supervisor, Jordan Williams
  Supervisee), `pdfTemplateKey = 'recovery_innovations_v1'`.
- Paycor swagger v1/v2 saved at `docs/paycor/`.

## Current state

- Branch: `main`, latest commit `42d71d4`
- Working tree: clean
- Tests: 441 passing (39 files)
- Build: green
- Sign-reminders cron: paused
- Rules-update cron: paused
- Dev and prod: SAME Neon database (split before go-live)

## What this phase builds (4 passes)

All passes are in our hands — no RI blockers. Each ships with tests
and a tight commit.

### Pass 1 — Paycor sync abstraction layer (~4 hrs)

**Goal:** Define the normalized change type and the service that applies
it, with a mock Paycor provider for testing.

**New files:**
- `src/lib/hris/types.ts` — `PaycorEmployee`, `PaycorChange` union type
- `src/lib/hris/paycor-provider.ts` — interface + mock implementation
- `src/lib/hris/apply-change.ts` — `applyPaycorChange()` function
- `tests/lib/hris/apply-change.test.ts`

**`PaycorChange` type** (from spec `13-paycor-integration.md` §2B):
```ts
type PaycorChange =
  | { kind: 'employee_hired'; employee: PaycorEmployee }
  | { kind: 'employee_terminated'; employeeId: string; terminatedAt: Date }
  | { kind: 'leave_status_changed'; employeeId: string; status: LeaveStatus; effectiveAt: Date }
  | { kind: 'role_changed'; employeeId: string; auditHaloRole: OrgRole };
```

**`PaycorProvider` interface:**
```ts
interface PaycorProvider {
  fetchEmployees(legalEntityId: string): Promise<PaycorEmployee[]>;
  fetchEmployeeStatus(employeeId: string): Promise<PaycorEmployeeStatus>;
}
```

Mock provider returns configurable test data. Real provider (Phase 3)
calls `apis.paycor.com` with APIM + OAuth headers.

**`applyPaycorChange()`** handles each change kind:
- `employee_hired` → create user + org_membership + invite email (reuses `commitHrisImportAction` path)
- `employee_terminated` → soft-deactivate (`deactivatedAt = NOW()`)
- `leave_status_changed` → update `org_memberships.leaveStatus`
- `role_changed` → update `org_memberships.role` + `users.role`

Each change writes an audit log entry with `action: 'paycor_sync.*'`
and `source: 'paycor'`.

### Pass 2 — Daily sync cron endpoint (~3 hrs)

**Goal:** Cron endpoint that polls Paycor for roster changes and applies
them via the abstraction layer.

**New files:**
- `src/app/api/cron/paycor-sync/route.ts` — POST handler, CRON_SECRET gated
- `src/lib/hris/diff-roster.ts` — compare Paycor roster to AuditHalo roster, produce `PaycorChange[]`
- `tests/lib/hris/diff-roster.test.ts`

**Logic:**
1. Authenticate via `CRON_SECRET` header (same pattern as sign-reminders)
2. For each org with `paycorConfig` set:
   a. Call `provider.fetchEmployees(legalEntityId)`
   b. Diff against current `org_memberships` roster
   c. Produce `PaycorChange[]` (new hires, terminations, status changes)
   d. Apply each change via `applyPaycorChange()`
   e. Log summary to audit log
3. Return 200 with change count

**Schedule:** Daily at 18:00 ET (after RI's COB). GitHub Actions
workflow `paycor-sync.yml`, schedule paused initially (same pattern
as sign-reminders).

### Pass 3 — SFTP delivery queue worker (~4 hrs)

**Goal:** On session seal, enqueue the RI PDF for SFTP delivery. Worker
pushes to Paycor employee Documents folder.

**New files:**
- `src/lib/hris/sftp-delivery.ts` — queue job type + delivery function
- `src/app/api/cron/sftp-delivery/route.ts` — processes queued deliveries
- `tests/lib/hris/sftp-delivery.test.ts`

**Schema addition** (migration 0031):
- `organizations.paycorConfig` JSONB — stores per-org Paycor connection
  details (legalEntityId, sftpHost, sftpUser, sftpBasePath). Encrypted
  at rest via Neon. Added in this pass, not earlier.

**Trigger:** `generateEvidencePackage()` in `src/lib/evidence.ts` already
runs on seal. Add a post-generation hook: if org has `paycorConfig` set,
insert a delivery queue row.

**Queue table** (migration 0031):
```sql
CREATE TABLE paycor_delivery_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  evidence_package_id UUID NOT NULL REFERENCES evidence_packages(id),
  paycor_employee_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending/delivered/failed
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Worker logic:**
1. Cron fires every 5 minutes (or on-demand after seal)
2. Pick up `pending` rows with `attempts < 3`
3. For each: render PDF, SFTP push, mark `delivered`
4. On failure: increment `attempts`, log error, notify HR Admin after 3 failures

**Mock SFTP:** Writes to a local directory instead of real SFTP.
Real SFTP uses `ssh2-sftp-client` (add as dependency in this pass).

**Filename:** `{YYYY-MM-DD}_supervision_{lastName}_{firstName}_{ruleVersion}.pdf`
(per Damon's suggestion from the RI call).

### Pass 4 — HR Admin Paycor dashboard panel (~2 hrs)

**Goal:** A "Paycor Integration" card on the HR Admin dashboard
showing connection status and recent sync/delivery activity.

**New files:**
- `src/app/app/dashboard/_paycor-panel.tsx` — server component
- Integration into `_supervisor-dashboard.tsx` or a new settings page

**States:**
- **Not connected:** "Connect your Paycor account to sync your roster
  and deliver supervision forms automatically." with a setup CTA
  (placeholder — real setup flow in Phase 3).
- **Connected:** Last sync time, employee count, recent deliveries,
  any failures with "Retry" button.

**Visibility:** HR Admin only. Gated by `org.paycorConfig !== null`.

## Schema changes (migration 0031)

```sql
-- paycor connection config per org
ALTER TABLE organizations ADD COLUMN paycor_config jsonb;

-- SFTP delivery queue
CREATE TABLE paycor_delivery_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  evidence_package_id UUID NOT NULL REFERENCES evidence_packages(id) ON DELETE CASCADE,
  paycor_employee_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_delivery_queue_pending
  ON paycor_delivery_queue (status, created_at)
  WHERE status = 'pending';
```

## What this phase does NOT build

- Real Paycor API calls (needs credentials from RI)
- Real SFTP delivery (needs partner spec from Paycor)
- Auto-provisioning supervisor assignment logic (needs Matt+Nick)
- JC standards cron (needs Tricia)
- Paycor setup UI flow (Phase 3 — after we have creds to test against)
- AI transcription (Wave 3)

## Open questions (none blocking — defaults chosen)

| Question | Default | Revisit when |
|---|---|---|
| Supervisor assignment on auto-provision | Leave null, surface "N unassigned" notification | Matt+Nick reply |
| SFTP one-cred-per-org or shared | Per-org config in `paycorConfig` JSONB | Paycor partner support replies |
| Sync SLA (daily vs more frequent) | Daily at 18:00 ET per Bree | Alicia/Joy push back |

## Dependency order

```
Pass 1 (abstraction layer)
  └── Pass 2 (daily sync cron) — uses Pass 1's applyPaycorChange()
  └── Pass 3 (SFTP delivery) — independent of Pass 2, depends on evidence.ts
Pass 4 (dashboard panel) — independent, can run in parallel with 1-3
```

Passes 1 and 4 can run in parallel. Pass 2 depends on Pass 1. Pass 3
is independent but should come after Pass 1 for consistency.

## Files touched summary

### New files (~12 total)
- `src/lib/hris/types.ts`
- `src/lib/hris/paycor-provider.ts`
- `src/lib/hris/apply-change.ts`
- `src/lib/hris/diff-roster.ts`
- `src/lib/hris/sftp-delivery.ts`
- `src/app/api/cron/paycor-sync/route.ts`
- `src/app/api/cron/sftp-delivery/route.ts`
- `src/app/app/dashboard/_paycor-panel.tsx`
- `.github/workflows/paycor-sync.yml`
- `drizzle/0031_paycor_config_and_delivery_queue.sql`
- `tests/lib/hris/apply-change.test.ts`
- `tests/lib/hris/diff-roster.test.ts`

### Modified files (~4)
- `src/lib/db/schema.ts` — add `paycorConfig`, `paycorDeliveryQueue` table
- `src/lib/evidence.ts` — post-generation SFTP queue hook
- `src/lib/audit-log.ts` — add `paycor_sync.*` action codes
- `docs/HANDOFF.md` — update status

## Estimated effort

| Pass | Effort |
|---|---|
| 1 — Abstraction layer | ~4 hrs |
| 2 — Daily sync cron | ~3 hrs |
| 3 — SFTP delivery | ~4 hrs |
| 4 — Dashboard panel | ~2 hrs |
| **Total** | **~13 hrs (2-3 sessions)** |

## Authorization notes

Per AGENTS.md:
- Migration 0031 requires Caleb's "yes" before applying to prod.
- All code changes, tests, and doc updates are autonomous.
- No `git push` without Caleb's review (per preference).

## References

- Master Wave 2 spec: `docs/strategy/13-paycor-integration.md`
- Paycor swagger: `docs/paycor/paycor-public-api-v1.json`, `v2.json`
- 2E plan (completed): `nimbalyst-local/plans/2e-ri-clinical-supervision-form.md`
- Existing HRIS import action: `src/app/actions/hris-import.ts`
- Sign-reminders cron pattern: `src/app/api/cron/sign-reminders/route.ts`
