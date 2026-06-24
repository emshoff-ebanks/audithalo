# HRIS integration — Enterprise tier promise

**Status:** Phase 1 shipped (CSV upload). Phase 2/3 (Merge.dev pull + webhook) **pivoted 2026-06-24** — the lead path is now **direct Paycor integration** per Recovery Innovations' 2026-06-17 sign-off. Merge.dev remains the fallback for non-RI Enterprise customers with non-Paycor HRIS.

**Read first:** `docs/strategy/13-paycor-integration.md` — the Wave 2 spec for the RI Paycor work. This doc covers the broader HRIS strategy and the Merge.dev fallback path.

## Why HRIS at all

The Enterprise tier card on /pricing promises "HRIS integration (Paycor direct / Merge.dev / CSV)". That promise has two operative parts:

1. **Static promise:** customers using Paycor/Workday/BambooHR/Rippling/ADP/Gusto can onboard their team without manually typing each email.
2. **Continuous promise:** when HR hires someone or terminates them, that change flows into AuditHalo automatically so the supervisee roster stays in sync.

Phase 1 (the CSV upload) keeps the static promise. The Paycor work (`docs/strategy/13-paycor-integration.md`) and the Merge.dev fallback path keep the continuous promise.

## Phase 1 — CSV upload (DONE)

- `/dashboard/team/import` — HR Admin only.
- Paste CSV or upload `.csv`. Header is case-insensitive.
- Validation:
  - Required columns: `email`, `role`
  - Optional columns: `name`, `primary_supervisor_email`, `rule_id`, `obligation_started_at`, `external_id`
  - Common aliases mapped (e.g. `Email Address`, `Supervisor`, `Employee ID`)
  - Per-row: email format, role enum, supervisee-only fields rejected on other roles, supervisor reference resolves to either a CSV row or an existing org supervisor
- Preview shows: total valid rows, supervisee count vs seat cap remaining, executive seat budget, conflict reasons (existing member / open invite — both skip), error list
- Commit:
  - Max 500 rows per import (`MAX_CSV_ROWS`)
  - Bulk-creates invitations, drains executive seat budget as it goes, fires Resend email per row, returns per-row outcome
  - One audit log entry for the whole batch with `bulk_import: true` + summary counts
  - No TOTP gate at the import boundary (per Damon: HR Admin who has bulk-import permission and is signed in is already trusted; per-row TOTP would be hostile)

Files:
- `src/lib/hris/csv-parser.ts` — pure parsing + validation
- `src/lib/hris/merge-dev.ts` — scaffold types + rollout phase comment
- `src/app/actions/hris-import.ts` — preview + commit server actions
- `src/app/app/dashboard/team/import/page.tsx` — HR Admin UI
- `tests/lib/hris/csv-parser.test.ts` — parser tests

## Direct Paycor path (the new lead path)

Recovery Innovations is the lead paying customer and uses Paycor exclusively. Per the 2026-06-17 call (full spec in `docs/strategy/13-paycor-integration.md`):

- Two-way sync via Paycor's API + outbound SFTP for sealed PDFs.
- Custom fields on Paycor side carry the AuditHalo role (HR admin / supervisor / supervisee / executive) and an on-leave / PRN flag.
- Lifecycle state expansion (`leave_status` column on `org_memberships`) handles on-leave + PRN semantics.
- Auto-provisioning service reuses `commitHrisImportAction` — same downstream commit path as the CSV phase.

Implementation phases (Phase 0 → 4) are detailed in `docs/strategy/13-paycor-integration.md`. The Merge.dev sections below remain valid as the **fallback path** for Enterprise customers on other HRIS systems.

## Phase 2 — Merge.dev pull-only (fallback path)

**Trigger to start:** Enterprise customer on a non-Paycor HRIS (Workday / BambooHR / Rippling / etc.) requests it, OR Damon signs a Merge.dev annual contract speculatively.

**Work estimate:** 1–2 days.

**Scope:**
- Add `MERGE_API_KEY` to env (per environment).
- Add `merge_account_token` (encrypted) column on `org_settings`.
- HR Admin clicks "Connect HRIS" → opens Merge Link UI → on success we store the account token.
- Nightly cron pulls `/employees` for each linked org. Diffs vs current org members. Surfaces the diff on `/dashboard/team/import` with a "Import these" button that reuses the existing commit action.

**Downstream reuse:** the existing `commitHrisImportAction` is structured to accept ParsedRow[] directly — Phase 2 only adds a new entry point that produces ParsedRow[] from `MergeEmployee[]` via `mergeEmployeeToParsedRow()`.

**Role-mapping problem:** Merge doesn't have an "is_supervisor" field. HR Admin must designate roles at onboarding (one-time mapping spreadsheet) or via HRIS-side tags/groups. For Phase 2 we default everyone to "supervisee" and let HR Admin edit before confirming the import.

## Phase 3 — Merge.dev webhook + auto-invite (fallback path)

**Trigger to start:** Merge.dev pull phase has been live for ≥30 days with no escalations.

**Work estimate:** 1 week.

**Scope:**
- Subscribe to Merge.dev `employee.created` and `employee.terminated` webhooks.
- `employee.created` → auto-create pending invitation tagged `auto_invited: true`. Cron sends the email next morning (batched) so HR can review the queue before it goes out.
- `employee.terminated` → auto-deactivate the matching org membership. Audit log entry with `source: "hris_termination"`. Active supervisor assignments must be reassigned first (same guard as manual deactivate) — if any exist, queue a notification to HR Admin instead of auto-deactivating.

**Opt-in required:** new `org_settings.hris_auto_invite_enabled` boolean. Default false. HR Admin must explicitly enable.

## Security review punch list (when Phase 2 starts)

- Encrypt `merge_account_token` at rest (column-level encryption or KMS-wrapped).
- Webhook signature verification (`X-Merge-Webhook-Signature`).
- Rate-limit the inbound webhook handler (Merge can spike during bulk HR events).
- Per-org isolation in the cron — never let one org's account token leak into another's pull.
- Privacy review: which Merge fields we read vs which we persist (we should persist only what we use — email, name, external_id; never SSN/DOB/comp).

## Decisions not made yet

- Whether to bill Phase 2/3 as a separate add-on or include in Enterprise base. **Default:** include in Enterprise base — it's the "promise" that makes Enterprise worth the seat premium.
- Whether to support pull from multiple HRIS systems in one org (multi-entity practices). **Default:** no — single Merge linked account per org for v1.
- Whether to surface terminations as a notification before auto-deactivating. **Default:** yes — never silently deactivate a clinician's account; always notify the HR Admin first.
