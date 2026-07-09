# 20 — Hostile QA Fix Plan

> **Source:** Findings from doc 19 (hostile QA audit, 2026-07-09)
> **Goal:** Resolve all P0s and top P1s to reach client-handoff readiness
> **Approach:** Dependency-ordered passes. Each pass is independently shippable.

---

## Architecture Decisions (Read Before Coding)

### On CASCADE deletes

The schema has 25 `onDelete: "cascade"` FKs. Most are fine (auth_tokens, notifications, integrations — ephemeral data tied to a user). The problem is cascades on **compliance-critical data** that must outlive users:

| Table | FK Column | Current | Should Be | Why |
|-------|-----------|---------|-----------|-----|
| `session_events` | `superviseeId -> users` | cascade | **set null** | Sessions are compliance records |
| `session_events` | `orgId -> organizations` | cascade | keep cascade | Org deletion = all data goes (rare, intentional) |
| `evidence_packages` | `superviseeId -> users` | cascade | **set null** | Evidence must outlive the user |
| `evidence_packages` | `sessionEventId -> session_events` | cascade | **restrict** | If someone tries to delete a session with evidence, block it |
| `evidence_packages` | `orgId -> organizations` | cascade | keep cascade | Same as above |
| `audit_log_entries` | `actorUserId -> users` | cascade | **set null** | Audit trail must survive user deletion |
| `supervisee_rule_assignments` | `superviseeId -> users` | cascade | **set null** | Rule history is compliance data |
| `supervisor_assignments` | `supervisorId -> users` | cascade | **set null** | Assignment history is compliance data |
| `supervisor_assignments` | `superviseeId -> users` | cascade | **set null** | Same |
| `paycor_delivery_queue` | `evidencePackageId -> evidence_packages` | cascade | keep cascade | Delivery follows evidence lifecycle |

All other cascades (auth_tokens, obligations, notifications, integrations, org_memberships, invitations, calendar integrations) are fine — they're operational data, not compliance records.

### On `getCurrentMembership()` and multi-org

The function returns an arbitrary membership via `findFirst` with no ordering. Two fixes needed:
1. **Immediate:** Add `isNull(deactivatedAt)` filter
2. **Structural:** The app assumes one-user-one-org but the accept-invite flow allows multi-org. Until a proper org-context switcher exists, add `orderBy: desc(createdAt)` so the most recent active membership wins deterministically.

### On `users.role` vs membership role

`users.role` is read by the JWT callback (auth.ts:147) and stamped onto every session. But the ACTUAL role should come from the membership, not the user. The accept-invite bug (P0-4) is a symptom of this architectural mismatch. The fix is:
1. **Immediate (P0-4):** Stop overwriting `users.role` in accept-invite
2. **Structural (future):** Migrate the JWT callback to read role from the active membership instead of `users.role`

### On rate limiting

Options considered:
- **Vercel KV + `@upstash/ratelimit`**: Production-grade, works across serverless instances. Requires adding Upstash Redis via Vercel Marketplace. ~$0/mo on free tier (10k requests/day).
- **DB-backed counter table**: Works with existing Neon, no new dependency. Adds a query per attempt. Simple but adds DB load.
- **In-memory Map**: Unreliable on serverless (different instances). Rejected.

**Decision:** DB-backed for now (no new dependency). A `login_attempts` table with (email, ip, attempted_at). Query count in sliding window before processing. Can upgrade to Upstash later if DB load becomes a concern.

### On proxy.ts (dead code)

`proxy.ts` exports routing middleware but nothing imports it. No `middleware.ts` exists. The host-based routing it describes is handled by Vercel's project-level domain configuration instead. **Delete the file.** If middleware is needed later, write it fresh.

### On the two rule-drift crons

`rule-drift/route.ts` hashes raw HTML. `rules-update/route.ts` normalizes HTML first. They both write to `rule_source_snapshots` and overwrite each other. **Delete `rule-drift/route.ts`** and its vercel.json cron entry. `rules-update` is the correct implementation (normalizes before hashing). Update `rules-update` to also upsert the snapshot status field that `rule-drift` was setting.

---

## Pass 1: Data Integrity (P0-1, P0-3, P1-16)

**Why first:** These are data-loss and data-corruption bugs. Everything else is secondary if the compliance data can be destroyed or silently corrupted.

### 1a. Migration: Fix CASCADE deletes on compliance tables

**Schema changes in `src/lib/db/schema.ts`:**

```
session_events.superviseeId:         onDelete: "cascade" -> "set null"
evidence_packages.superviseeId:      onDelete: "cascade" -> "set null"
evidence_packages.sessionEventId:    onDelete: "cascade" -> "restrict"
audit_log_entries.actorUserId:       onDelete: "cascade" -> "set null"
supervisee_rule_assignments.superviseeId: onDelete: "cascade" -> "set null"
supervisor_assignments.supervisorId: onDelete: "cascade" -> "set null"
supervisor_assignments.superviseeId: onDelete: "cascade" -> "set null"
```

**Also make these columns nullable** (they're currently `notNull()`):
- `session_events.superviseeId` -> remove `.notNull()`
- `evidence_packages.superviseeId` -> remove `.notNull()`
- `audit_log_entries.actorUserId` -> remove `.notNull()`
- `supervisee_rule_assignments.superviseeId` -> remove `.notNull()`
- `supervisor_assignments.supervisorId` -> remove `.notNull()`
- `supervisor_assignments.superviseeId` -> remove `.notNull()`

**Generate migration:** `npm run db:generate`

**Code impact — queries that assume these columns are NOT NULL:**
- `evidence.ts:43` — `superviseeRuleAssignments` query by superviseeId. Already needs orgId filter (P1-7). Add null-safety.
- `supervisee.ts:291` — same query. Add orgId filter + null-safety.
- Dashboard metrics, roster queries — anywhere `superviseeId` is used in a WHERE or JOIN. Grep for all references and add null checks.
- Evidence PDF rendering — `supervisee.name` could be null if user was purged. Show "[Deleted user]" fallback.
- Audit log display — `actorUserId` null means "deleted user performed this action". Show "[Deleted user]" in the UI.

**Test:** Run `npm test` after migration. Fix any test failures from the nullability change.

### 1b. Fix post-seal signature append (P0-3)

**File:** `src/app/actions/signatures.ts:153-161`

Add `AND signed_at IS NULL` to the UPDATE WHERE clause:

```sql
UPDATE session_events
SET signatures = signatures || ${newSigJson}::jsonb
WHERE id = ${sessionEvent.id}
  AND signed_at IS NULL           -- ADD THIS LINE
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(signatures) AS s
    WHERE s->>'signerId' = ${candidate.signerId}
  )
RETURNING signed_at, signatures
```

Also add an early return at the TypeScript level (before the SQL) for a clear error message:

```typescript
if (sessionEvent.signedAt) {
  return { ok: false, error: "This session is already sealed and cannot accept new signatures." };
}
```

**Test:** The existing E2E `sign-session-and-seal.spec.ts` should still pass. Add a unit test that attempts to sign a sealed session and expects rejection.

### 1c. Fix silent evidence generation failure (P1-16)

**File:** `src/lib/evidence.ts:43-49`

When `superviseeRuleAssignments` is missing, the function silently returns after logging. The session is sealed but has no evidence package. Two fixes:
1. Change `signSessionAction` to check for rule assignment BEFORE sealing
2. Add `orgId` filter to the query (P1-7 fix):

```typescript
const assignment = await db.query.superviseeRuleAssignments.findFirst({
  where: and(
    eq(schema.superviseeRuleAssignments.superviseeId, event.superviseeId),
    eq(schema.superviseeRuleAssignments.orgId, event.orgId)  // ADD THIS
  ),
});
```

---

## Pass 2: Billing Integrity (P0-5, P0-6, P1-3)

### 2a. Fix Stripe periodEnd extraction (P0-5)

**File:** `src/app/api/stripe/webhook/route.ts:18-20`

Replace:
```typescript
const periodEnd =
  (firstItem as { current_period_end?: number } | undefined)
    ?.current_period_end ?? null;
```

With:
```typescript
const periodEnd = sub.current_period_end ?? null;
```

`current_period_end` is a top-level field on the Subscription object, not on items.

### 2b. Add existing-subscription guard (P0-6)

**File:** `src/app/actions/billing.ts`

After fetching the org (~line 80), add:

```typescript
if (org.stripeSubscriptionId) {
  return { ok: false, error: "Your organization already has an active subscription. Visit Billing to manage it." };
}
```

### 2c. Wrap seat cap check in transaction (P1-3)

**File:** `src/app/actions/invitations.ts:212-261`

Wrap the seat count query + invitation insert in a Drizzle transaction:

```typescript
await db.transaction(async (tx) => {
  const currentCount = await tx.select(...).where(...);
  if (currentCount >= cap) throw new Error("Seat cap exceeded");
  await tx.insert(schema.invitations).values(...);
});
```

This eliminates the TOCTOU race where two concurrent invitations both pass the check.

---

## Pass 3: Auth & Identity (P0-4, P0-2, P1-1, P1-2, P1-5, P1-8, P1-9)

### 3a. Fix accept-invite role overwrite (P0-4)

**File:** `src/app/actions/accept-invite.ts:268-277`

Remove the `users.role` update entirely from `acceptInviteAsExistingUserAction`:

```typescript
// DELETE THIS BLOCK:
// if (currentUser && currentUser.role !== invite.role) {
//     await db.update(schema.users).set({ role: invite.role, ... })
// }
```

The per-membership role is what matters. The JWT callback already reads `users.role`, but since we're not changing it, the user keeps their original role. The membership role handles org-specific access.

**Also in `acceptInviteAction` (new-user path):** The new user's `users.role` should be set from the invitation role. This is correct — it's the user's first and only role.

### 3b. Add rate limiting (P0-2)

**New file:** `src/lib/rate-limit.ts`
**New table:** `rate_limit_attempts` with columns: `id`, `key` (email or IP), `action` (login/signup/reset), `attemptedAt`, auto-expire index.

```typescript
export async function checkRateLimit(
  key: string,
  action: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const windowStart = new Date(Date.now() - windowMs);
  const count = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM rate_limit_attempts
    WHERE key = ${key} AND action = ${action} AND attempted_at > ${windowStart.toISOString()}
  `);
  if (count >= maxAttempts) return { allowed: false, retryAfterMs: windowMs };
  await db.execute(sql`
    INSERT INTO rate_limit_attempts (key, action, attempted_at) VALUES (${key}, ${action}, NOW())
  `);
  return { allowed: true };
}
```

**Apply to:**
- `loginAction`: 5 attempts per email per 15 minutes
- `signupAction`: 3 attempts per IP per 15 minutes
- `requestPasswordResetAction`: 3 per email per hour
- `resendInvitationAction`: 3 per invitation per hour

**Add cleanup cron or TTL:** Delete rows older than 1 hour in daily-checks Pass 5.

**Schema change:** Add `rate_limit_attempts` table. Generate migration.

### 3c. Fix sole-HR-Admin delete (P1-1)

**File:** `src/app/actions/account.ts:794-846`

Before soft-deleting, check:
```typescript
const activeAdmins = await db.query.orgMemberships.findMany({
  where: and(
    eq(schema.orgMemberships.orgId, membership.orgId),
    eq(schema.orgMemberships.role, "hr_admin"),
    isNull(schema.orgMemberships.deactivatedAt)
  ),
});
if (activeAdmins.length <= 1 && activeAdmins.some(m => m.userId === session.user.id)) {
  return { ok: false, error: "You are the only HR Admin. Transfer the role before deleting your account." };
}
```

### 3d. Fix signup email enumeration (P1-2)

**File:** `src/app/actions/auth.ts:42-49`

Replace the existing-user error with a generic message and always run bcrypt:

```typescript
const existing = await db.query.users.findFirst({
  where: eq(schema.users.email, emailLower),
});
// Always hash to prevent timing side-channel
const passwordHash = await bcrypt.hash(password, 12);
if (existing) {
  return { ok: false, error: "Check your email for next steps." };
}
```

And send a "someone tried to sign up with your email" notification to the existing user (optional but good practice).

### 3e. Fix HR Admin self-deactivation (P1-5)

**File:** `src/app/actions/team.ts:370-477`

Add after the target membership is loaded:
```typescript
if (target.userId === session.user.id) {
  return { ok: false, error: "You cannot deactivate yourself." };
}
```

### 3f. Fix getCurrentMembership (P1-8, P1-9)

**File:** `src/lib/authz.ts:125-129`

Replace:
```typescript
export async function getCurrentMembership(userId: string) {
  return db.query.orgMemberships.findFirst({
    where: eq(schema.orgMemberships.userId, userId),
  });
}
```

With:
```typescript
export async function getCurrentMembership(userId: string) {
  return db.query.orgMemberships.findFirst({
    where: and(
      eq(schema.orgMemberships.userId, userId),
      isNull(schema.orgMemberships.deactivatedAt)
    ),
    orderBy: desc(schema.orgMemberships.createdAt),
  });
}
```

This filters out deactivated memberships and deterministically returns the most recent active one.

---

## Pass 4: Cron & Monitoring (P0-7, P1-10, P1-11, P1-15)

### 4a. Delete rule-drift cron, keep rules-update (P0-7)

**Delete:** `src/app/api/cron/rule-drift/route.ts` (entire file/directory)
**Remove from vercel.json:** the `rule-drift` cron entry
**Update `rules-update`:** Ensure it sets both `contentHash` and `status` fields on the snapshot, covering what `rule-drift` used to do.

### 4b. Fix sign reminder stamp ordering (P1-10)

**File:** `src/app/api/cron/sign-reminders/route.ts:118-176`

Move the `signReminderSentAt` stamp to AFTER successful notification delivery:
```typescript
// 1. Send notification FIRST
try {
  await createNotification(...);
} catch (err) {
  console.error(...);
  failed++;
  continue; // Don't stamp — retry on next cron run
}
// 2. THEN stamp (only on success)
await db.update(schema.sessionEvents)
  .set({ signReminderSentAt: now })
  .where(eq(schema.sessionEvents.id, s.id));
sent++;
```

### 4c. Fix session reminder N+1 queries (P1-11)

**File:** `src/app/api/cron/scheduled-session-reminders/route.ts:105-129`

Batch the dedup query: load all recent notifications for all attendees in one query, build a Set, then check against it:

```typescript
const recentNotifs = await db.select(...)
  .from(schema.notifications)
  .where(and(
    inArray(schema.notifications.userId, allAttendeeIds),
    eq(schema.notifications.kind, reminderKind),
    gte(schema.notifications.createdAt, twentyFourHoursAgo)
  ));
const sentSet = new Set(recentNotifs.map(n => `${n.userId}|${(n.payload as any).sessionId}`));
// Then check: if (sentSet.has(`${attendeeId}|${sessionId}`)) skip;
```

### 4d. Add canceled session filter (P1-15)

**File:** `src/app/api/cron/scheduled-session-reminders/route.ts:74-80`

Add to the WHERE clause:
```typescript
isNull(schema.sessionEvents.canceledAt)
```

---

## Pass 5: Data Scoping & PHI (P1-6, P1-7)

### 5a. Add PHI scan to auto-fetched transcripts (P1-6)

**File:** `src/app/actions/ai-note.ts:249+`

After fetching the transcript and before calling `generateSessionNote`, run the PHI scanner:

```typescript
import { scanForPhi } from "@/lib/ai/phi-scan";

const phiResults = scanForPhi(transcript);
if (phiResults.length > 0) {
  return {
    ok: false,
    error: `The transcript contains potential PHI (${phiResults.map(r => r.type).join(", ")}). Remove sensitive information before generating an AI note.`,
  };
}
```

### 5b. Add orgId to rule assignment queries (P1-7)

**Files:** `src/lib/evidence.ts:43`, `src/app/actions/supervisee.ts:291`

Add `eq(schema.superviseeRuleAssignments.orgId, event.orgId)` to both queries. (Shown in Pass 1c above for evidence.ts; same pattern for supervisee.ts.)

---

## Pass 6: Cleanup & Dead Code

### 6a. Delete proxy.ts (P1-19)

**Delete:** `src/proxy.ts`
It's dead code — nothing imports it, no middleware.ts exists.

### 6b. Delete rule-drift cron (done in Pass 4a)

### 6c. Fix ESLint errors

- `session-log.tsx:328` — Replace ref-during-render with a callback ref or state variable
- `hris/apply-change.ts` — Change `let` to `const`
- `RiClinicalSupervisionPdf.tsx` — Remove unused variables `RI_GOLD`, `RI_LIGHT_PURPLE`; add alt text to Image
- `calendar/providers/google.ts` — Remove unused `_joinUrl`

### 6d. Fix test type errors (19 errors in test fixtures)

Add missing `scheduledStatus` field, fix `permitExpiresAt` type (use `null` not `undefined`), fix Paycor test fixtures to include all required PaycorConfig fields.

### 6e. Apply safe npm audit fixes

```bash
npm audit fix  # fixes OpenTelemetry + DOMPurify (non-breaking)
```

---

## Pass 7: Infrastructure Hardening

### 7a. Configure Vitest coverage reporting

**File:** `vitest.config.ts`

Add:
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json-summary'],
  include: ['src/app/actions/**', 'src/app/api/**', 'src/lib/**'],
}
```

### 7b. Extend jsx-a11y ESLint config

**File:** ESLint config

Add `plugin:jsx-a11y/recommended` to extends (or flat config equivalent).

### 7c. Fix migration journal

Add entries for migrations 0018-0033 to `drizzle/meta/_journal.json` so the standard migrator applies all 34 migrations.

---

## Dependency Graph

```
Pass 1 (data integrity)
  ├─ 1a: CASCADE migration ──────────────────────┐
  ├─ 1b: seal guard (signatures.ts)               │
  └─ 1c: evidence orgId fix                       │
                                                   │
Pass 2 (billing) ─── can run in parallel with 1 ──┤
  ├─ 2a: periodEnd fix                            │
  ├─ 2b: double-billing guard                     │
  └─ 2c: seat cap transaction                     │
                                                   │
Pass 3 (auth) ─── depends on Pass 1a (nullable cols)
  ├─ 3a: accept-invite role fix
  ├─ 3b: rate limiting (new table + migration)
  ├─ 3c: sole-admin delete guard
  ├─ 3d: signup enumeration fix
  ├─ 3e: self-deactivation guard
  └─ 3f: getCurrentMembership fix
                                                   
Pass 4 (crons) ─── can run in parallel with 3
  ├─ 4a: delete rule-drift cron
  ├─ 4b: sign reminder ordering
  ├─ 4c: session reminder N+1
  └─ 4d: canceled session filter

Pass 5 (scoping) ─── can run in parallel with 4
  ├─ 5a: PHI scan on auto-transcripts
  └─ 5b: orgId filters (partially done in 1c)

Pass 6 (cleanup) ─── after all above
  ├─ 6a-6e: dead code, lint, test fixtures

Pass 7 (infra) ─── after all above
  ├─ 7a-7c: coverage, a11y lint, journal fix
```

---

## Migration Safety

All schema changes in this plan require Drizzle migrations run against the database. Per AGENTS.md:
- `npm run db:generate` can be run freely
- The generated SQL must be shown to Damon before `db:push` against any environment
- Test locally first: `DATABASE_URL=<dev> npx drizzle-kit push`
- Production migration requires explicit Damon approval

**Migrations in this plan:**
1. Pass 1a: ALTER FK constraints on 7 columns (session_events, evidence_packages, audit_log_entries, supervisee_rule_assignments, supervisor_assignments). Also ALTER columns to nullable.
2. Pass 3b: CREATE TABLE rate_limit_attempts.

Both are non-destructive (no data loss, no column drops). Safe to apply to a live database.

---

## Estimated Effort

| Pass | Items | Est. Hours | Risk |
|------|-------|------------|------|
| 1 | CASCADE fix + seal guard + evidence fix | 4-6h | High (migration) |
| 2 | Stripe fixes + seat cap transaction | 2-3h | Medium |
| 3 | Auth fixes + rate limiting | 6-8h | Medium (new table) |
| 4 | Cron fixes + delete dead cron | 3-4h | Low |
| 5 | PHI scan + orgId filters | 2h | Low |
| 6 | Cleanup | 2-3h | Low |
| 7 | Infra | 2h | Low |
| **Total** | **26 items** | **~22-28h** | |

---

## Verification Checklist

After all passes complete:

- [ ] `npm test` — all 528+ tests pass
- [ ] `npm run build` — clean build
- [ ] `npm run lint` — zero errors (warnings acceptable)
- [ ] `npx tsc --noEmit` — zero errors in src/
- [ ] `npm run validate:rules` — 5 rules pass
- [ ] E2E `sign-session-and-seal` — signs, seals, evidence generated
- [ ] E2E hostile RBAC — still returns 403/redirect
- [ ] Manual: delete a test user account, verify sessions/evidence survive
- [ ] Manual: attempt login brute-force, verify rate limit kicks in
- [ ] Manual: two-tab checkout, verify second tab rejected
- [ ] Manual: accept invite as existing user, verify original role preserved
