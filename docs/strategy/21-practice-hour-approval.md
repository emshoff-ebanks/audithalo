# 21 — Practice Hour Supervisor Approval Queue

> **Status:** In progress
> **Depends on:** Signing order enforcement (shipped 2026-08-31)

---

## Summary

Practice hours logged by supervisees require supervisor approval before
counting toward rule evaluation. Rejected hours are deleted with a
reason notification. No grandfathering — this is the only flow going forward.

## Schema

Add to `session_events`:

```
approvedAt         TIMESTAMPTZ  NULL   -- null = pending, set = approved
approvedByUserId   UUID         NULL   REFERENCES users(id) ON DELETE SET NULL
```

## Flow

1. Supervisee logs practice hours (existing form, unchanged)
2. Row inserted with `approvedAt = NULL`
3. Supervisor notified: "N practice hours pending review for [supervisee]"
4. Supervisor opens supervisee detail page, sees review queue
5. Supervisor clicks Approve (single or batch) or Reject (with reason)
6. On approve: `approvedAt = NOW()`, `approvedByUserId = supervisor.id`
7. On reject: row deleted, supervisee notified with reason, audit log entry
8. Only approved practice hours count in rule evaluation

## Changes by file

### Schema + migration
- `src/lib/db/schema.ts`: Add `approvedAt` + `approvedByUserId` to `sessionEvents`
- Generate migration SQL

### Rule engine filter (2 locations)
- `src/lib/rules/evaluation-context.ts` ~line 46: Skip practice events where `approvedAt` is null
- `src/lib/db/roster-queries.ts` ~line 224: Same filter in batch path

### New server action
- `src/app/actions/practice-approval.ts`:
  - `approvePracticeHoursAction(ids: string[])` — batch approve
  - `rejectPracticeHoursAction(id: string, reason: string)` — delete + notify

### New UI component
- `src/app/app/dashboard/roster/[superviseeId]/_practice-review-queue.tsx`:
  - Table: date, hours, direct contact, state
  - Per-row Approve + Reject buttons
  - Batch "Approve all" button
  - Reject shows a reason text input

### Session log badge
- `src/components/app/session-log.tsx`: Show "Awaiting approval" badge for
  practice events where `approvedAt` is null

### Notifications
- New kind: `practice_hours_submitted` — sent to supervisor when supervisee logs practice hours
- New kind: `practice_hours_rejected` — sent to supervisee with reason on rejection
- `practice_hours_submitted` added to supervisor's notification kinds
- `practice_hours_rejected` added to supervisee's notification kinds

### Audit log
- `AUDIT_ACTIONS.PRACTICE_HOURS_APPROVED`
- `AUDIT_ACTIONS.PRACTICE_HOURS_REJECTED`

## What does NOT change
- Practice hour logging form (supervisee side)
- Dashboard progress bars (auto-reflect from evaluation totals)
- Gap renderer (derives from evaluation)
- Evidence packages (practice events don't get evidence packages)
- Supervision session signing flow
