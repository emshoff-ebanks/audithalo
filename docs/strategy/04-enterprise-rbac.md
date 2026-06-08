# Enterprise RBAC + multi-supervisor org

_Drafted 2026-06-07. Companion to `01-launch-plan.md` (the original tier spec), `02-beta-readiness.md` (gap inventory), and `03-campaign-execution.md` (campaign sequencing). This doc is the canonical plan for the Enterprise tier's role model. Implementation lives on the `release/enterprise` branch and bulk-merges to main when the pre-merge gate is green._

## Why this exists

Today an org has one supervisor (the buyer) + N supervisees (free). An Enterprise customer is a group practice with multiple supervisors, an HR/compliance lead, and sometimes external oversight (board members, partner clinics). Selling Enterprise without proper role separation is impossible — the HR lead can't be a clinical supervisor, the supervisors don't need the practice-wide rollup, and the executive read-only role doesn't exist at all.

## Locked decisions

These are the answers from the planning conversation; don't re-litigate them:

1. **HR Admin and Supervisor are separate accounts.** An HR Admin who happens to also be a credentialed clinical supervisor needs a second account. We surface this clearly at the upgrade flow ("HR Admin role doesn't sign sessions. If you supervise clinically, that's a separate Supervisor account.").
2. **Practice supervisor → Enterprise auto-promotes to HR Admin.** When an existing supervisor on Solo/Practice tier upgrades to Enterprise, that user's `org_memberships.role` flips to `hr_admin`. A pre-purchase warning makes this clear and notes: *"If you want a different email to be the HR Admin, sign up for Enterprise on that account instead."*
3. **Executive seats are free + capped at 5 per org.** Read-only oversight role. Doesn't count against billing.
4. **Both HR Admin and Supervisor can invite supervisees.** HR Admin can pick which Supervisor the supervisee gets assigned to (when there are multiple). Supervisor's invite auto-assigns to themselves.
5. **2FA required for sensitive HR Admin actions only.** Not full role-enforcement at login. Sensitive actions = inviting another HR Admin, exporting full audit log, deactivating a user.

## Role inventory

| Role | Source of truth | Combines | Buys/decides? |
|---|---|---|---|
| **HR Admin** | `org_memberships.role = 'hr_admin'` | HR + Super Admin (consolidated per Damon) | **Yes — Enterprise buyer** |
| **Supervisor** | `org_memberships.role = 'supervisor'` | Existing | Sometimes on smaller orgs (Solo/Practice tier) |
| **Executive** | `org_memberships.role = 'executive'` | New | No |
| **Supervisee** | `org_memberships.role = 'supervisee'` | Existing | No (free always) |

`users.role` field is deprecated for Enterprise — `org_memberships.role` becomes the source of truth. We keep `users.role` for backward compat with existing Solo/Practice orgs.

## Permission matrix

| Capability | Supervisee | Supervisor | HR Admin | Executive |
|---|---|---|---|---|
| View **own** progress / hours | ✅ | ✅ | ✅ (any user) | ✅ (any user) |
| Log practice session | ✅ | — | — | — |
| Sign supervision session | ✅ (own) | ✅ (their roster) | — | — |
| Assign state rule | — | ✅ (own roster) | ✅ | — |
| View **other** supervisees | — | ✅ (their roster) | ✅ (org-wide) | ✅ (org-wide, read) |
| Invite **Supervisee** | — | ✅ (assigns to self) | ✅ (picks supervisor) | — |
| Invite **Supervisor** | — | — | ✅ | — |
| Invite **HR Admin** | — | — | ✅ (2FA required) | — |
| Invite **Executive** | — | — | ✅ | — |
| Reassign supervisor↔supervisee | — | — | ✅ | — |
| Manage billing + plan | — | (solo orgs only) | ✅ | — |
| Manage org settings | — | — | ✅ | — |
| Manage integrations (HRIS, Teams, Calendar) | — | — | ✅ | — |
| View audit log | (own actions) | (own actions) | ✅ (full) | ✅ (read) |
| Export audit log (CSV/JSON) | — | — | ✅ (2FA) | ✅ |
| View executive rollup dashboard | — | — | ✅ | ✅ |
| View AI session note **content** | (own) | (their roster's) | (metadata only) | (metadata only) |
| Deactivate / soft-delete user | — | — | ✅ (2FA) | — |

**The clinical/admin firewall.** HR Admin cannot sign supervision sessions and cannot view AI note content (only metadata: dates, supervisor, topics list). This keeps the clinical chain of custody clean — a non-clinician can't insert themselves into the supervision record. If the practice owner is also a credentialed supervisor, they hold two separate accounts (per locked decision #1).

## Schema (migration 0023)

```sql
-- Extend the userRole enum (was: supervisor | supervisee) to add the new
-- roles. Drizzle enum extension requires DROP DEFAULT first.
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE org_memberships ALTER COLUMN role DROP DEFAULT;
ALTER TYPE user_role ADD VALUE 'hr_admin';
ALTER TYPE user_role ADD VALUE 'executive';
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'supervisee'::user_role;
ALTER TABLE org_memberships ALTER COLUMN role SET DEFAULT 'supervisee'::user_role;

-- New table: explicit supervisor → supervisee assignments. M:N because
-- one supervisee can have multiple supervisors (primary + secondary).
-- The cadence rules + signature requirements run against the primary.
CREATE TABLE supervisor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supervisor_id uuid NOT NULL REFERENCES users(id),
  supervisee_id uuid NOT NULL REFERENCES users(id),
  is_primary boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  transferred_from_supervisor_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, supervisor_id, supervisee_id) -- one row per active pairing
);

CREATE INDEX supervisor_assignments_supervisee_idx
  ON supervisor_assignments (supervisee_id) WHERE ended_at IS NULL;
CREATE INDEX supervisor_assignments_supervisor_idx
  ON supervisor_assignments (supervisor_id) WHERE ended_at IS NULL;

-- Soft-deactivation on memberships. Important: deactivated members keep
-- their existing signed sessions intact (audit trail is sacred). They
-- just can't log in or be assigned new work.
ALTER TABLE org_memberships
  ADD COLUMN deactivated_at timestamptz,
  ADD COLUMN deactivated_by_user_id uuid REFERENCES users(id);

-- Org-level settings: retention preferences, SSO config (later), branding.
-- One row per org, backfilled with defaults for every existing org.
CREATE TABLE org_settings (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  audit_log_retention_years integer NOT NULL DEFAULT 7,
  sso_provider text,
  sso_metadata_url text,
  branding_logo_url text,
  allow_supervisors_to_invite boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill: every existing org gets an org_settings row.
INSERT INTO org_settings (org_id)
SELECT id FROM organizations
ON CONFLICT (org_id) DO NOTHING;

-- Backfill: every existing supervisor → supervisee membership pair gets
-- a supervisor_assignments row (is_primary = true), so the new code can
-- read assignments without backfilling at runtime.
INSERT INTO supervisor_assignments (org_id, supervisor_id, supervisee_id, is_primary)
SELECT
  sup.org_id,
  sup.user_id AS supervisor_id,
  sve.user_id AS supervisee_id,
  true
FROM org_memberships sup
JOIN org_memberships sve ON sve.org_id = sup.org_id
WHERE sup.role = 'supervisor'
  AND sve.role = 'supervisee'
ON CONFLICT (org_id, supervisor_id, supervisee_id) DO NOTHING;
```

## Provisioning workflows

### 1. New Enterprise org from scratch

1. Damon (sales) creates the user manually via /admin or directly in DB
2. First user becomes HR Admin via the admin grant action
3. Org row created with `subscription_tier = 'enterprise'`
4. HR Admin lands at /dashboard/team → invites supervisors + supervisees from there

### 2. Practice → Enterprise upgrade

1. Existing supervisor on Practice tier visits /dashboard/billing
2. Sees "Upgrade to Enterprise" with a warning modal:
   > "Upgrading promotes **your** account to HR Admin. HR Admin manages billing, org settings, and team membership — but doesn't sign supervision sessions. **If you want to keep supervising clinically, this is the wrong account.** Create a second account at /register with a different email, then add it as a Supervisor under your org. Continue to upgrade?"
3. Stripe Checkout completes → webhook flips `subscriptionTier = 'enterprise'`
4. Webhook also flips that supervisor's `org_memberships.role` to `'hr_admin'`
5. Audit log entry: `user.role_changed_on_upgrade` (with old role)
6. Confirmation email lands explaining what just happened

### 3. Inviting a Supervisor (HR Admin only)

1. HR Admin → /dashboard/team → "Invite Supervisor"
2. Form: name, email, credential (LCMHCS / LPC-S / LCSW-S / "other"), state
3. Invitation row created with `pending_role = 'supervisor'`
4. Supervisor accepts via existing /accept-invite/[token]
5. New `org_memberships` row with `role = 'supervisor'`

### 4. Inviting a Supervisee (HR Admin OR Supervisor)

1. HR Admin: /dashboard/roster → "Invite supervisee" → name/email/state-rule/start-date + **Assign to supervisor** dropdown (lists all org supervisors)
2. Supervisor: same form but no dropdown — auto-assigns to themselves
3. Invitation row with `pending_assignment_supervisor_id` (new field) + the existing `pending_rule_id`
4. On accept: `org_memberships` row + `supervisor_assignments` row created in same flow

### 5. Inviting an HR Admin (requires 2FA)

1. HR Admin → /dashboard/team → "Add HR Admin"
2. Server action checks: inviter has TOTP enabled? If not, redirect to set up first.
3. Form: name, email + TOTP code confirmation
4. Invitation row with `pending_role = 'hr_admin'`
5. Acceptance creates membership with `role = 'hr_admin'`
6. Audit log entry: `user.invited_as_hr_admin`

### 6. Inviting an Executive

1. HR Admin → /dashboard/team → "Add Executive"
2. Form: name, email (no credential — they're read-only)
3. Org currently has < 5 active executives? Else block.
4. Invitation with `pending_role = 'executive'`
5. Acceptance → membership with `role = 'executive'`; on first login they're redirected to /dashboard/executive (their default landing)

### 7. Reassigning a Supervisor

1. HR Admin → /dashboard/roster → click supervisee → "Change Supervisor"
2. Modal: dropdown of all org supervisors, confirmation
3. Server action: closes existing `supervisor_assignments` row (set ended_at + transferred_from_supervisor_id), opens new row
4. Old supervisor + new supervisor both get bell notifications
5. Audit log: `supervisor_assignment.transferred`
6. **Existing signed sessions stay attributed to the supervisor who signed them.** Only new sessions flow to the new supervisor.

### 8. Deactivating a Supervisor

1. HR Admin → /dashboard/team → click supervisor → "Deactivate"
2. If supervisor has active supervisees: blocking modal — "Reassign N supervisees first."
3. HR Admin reassigns each (or bulk to a default supervisor)
4. Once all reassigned: soft-deactivate (membership.deactivated_at + deactivated_by_user_id)
5. Their existing signed sessions + audit-log entries stay untouched
6. They can't log in once deactivated (auth.ts rejects)

### 9. Deactivating an HR Admin

1. HR Admin → /dashboard/team → click HR Admin → "Deactivate"
2. Server-side guard: **org must always have ≥1 active HR Admin.**
3. If trying to deactivate the last one: block with "Promote another HR Admin first."
4. Soft-deactivate via same mechanism. 2FA confirmation required.

## Day-in-the-life workflows (smoke tests)

### HR Admin first week

- **Day 1:** Sign up via Damon's manual provisioning OR upgrade from Practice. Land on /dashboard/team. Invite 3 supervisors + 12 supervisees (HR-flow with supervisor-pick dropdown). Assign state rules.
- **Day 2:** Set up Microsoft Teams integration (when we ship it). Configure HRIS sync (CSV upload for v1). Review executive dashboard.
- **Day 7:** Handle the first "supervisee flagged at-risk" notification. Reassign one supervisee from Supervisor A → Supervisor B. Export audit log for the month.

### Supervisor first week (unchanged from Practice)

- **Day 1:** Accept invite → land on dashboard → see assigned roster (only their own, not full org) → review compliance status.
- **Day 2:** Log first supervision session → sign → see evidence package.
- **Day 7:** Respond to pending signature.

### Executive first week (new)

- **Day 1:** Accept invite → land directly at /dashboard/executive (no roster page for them). See practice-wide rollup: at-risk count, supervision hours logged this month, evidence packages sealed, top 5 supervisees nearing deadlines.
- **Day 2:** Drill into a flagged supervisee → see their hour math + signature queue (no AI note content).
- **Day 7:** Export the monthly audit log → review changes.

### Supervisee (unchanged)

## Edge cases the planning has to nail

1. **Single supervisee with multiple supervisors.** Yes, allowed. The `is_primary = true` row is the one cadence runs against. UI shows "Primary supervisor: X · Secondary: Y." Only the primary can sign supervision sessions for cadence enforcement.
2. **HR Admin who's also a clinical supervisor.** Per locked decision #1 — **separate accounts**. We surface this clearly at upgrade-time.
3. **Supervisor who's also a supervisee in the same org.** Edge case but allowed (clinician under supervision who also supervises others). Two `org_memberships` rows with different roles + a `supervisor_assignments` row where they're the supervisee.
4. **HR Admin tries to deactivate the last HR Admin.** Blocked server-side. Org always needs ≥1 active HR Admin.
5. **Supervisor leaves practice.** HR Admin must reassign all active supervisees before deactivation. Existing signed sessions stay attributed to the original supervisor (chain of custody).
6. **Executive tries to access /dashboard/roster.** Redirected to /dashboard/executive — they don't get the supervisor view.
7. **2FA enforcement.** Required for: inviting another HR Admin, exporting full audit log, deactivating any user. Not required for: regular HR Admin browsing, viewing executive dashboard.
8. **Practice tier supervisor upgrades to Enterprise but already has the `'supervisor'` membership.** That membership flips to `'hr_admin'` on upgrade (per locked decision #2). Audit log captures the role change.

## Out of scope for v1 Enterprise build

These features are mentioned in the original docs / pricing page but NOT shipping in this enterprise wave. Some require multi-week effort; some need real customer demand to justify the spec:

- **SSO (SAML / OIDC)** — 1-2 weeks of work. Build when the first Enterprise prospect requires it.
- **Full HIPAA / BAA infrastructure** — multi-week migration off Neon HTTP, signed BAAs with Resend + OpenAI / move to Azure OpenAI. Build when revenue funds it.
- **SOC 2** — external audit process, 3-6 months.
- **API (read + write)** — read-only scaffold lands; full read-write API + key rotation + scoped permissions ships when an Enterprise customer needs programmatic access.

## Pre-merge gate

Before this branch (`release/enterprise`) bulk-merges to main, ALL of these must be green:

**Automated (verified in this branch):**
- [x] vitest — 267/267 passing (was 237 before this branch; +30 new tests across RBAC, billing, HRIS)
- [x] tsc --noEmit — only 3 pre-existing test fixture errors (permitExpiresAt nullability); zero new errors from this branch
- [x] eslint on new files — clean (107 pre-existing apostrophe-escape warnings in marketing pages unchanged)
- [x] `next build` — production build succeeds, all new routes (/admin/orgs, /dashboard/team/import, /dashboard/executive, /dashboard/settings, /api/audit-log/export) compile

**Damon: pre-deploy checklist:**
- [ ] Migration 0023 applied on prod (via repair-migrations.ts) — see `drizzle/0023_enterprise_rbac_foundation.sql`
- [ ] Smoke test on preview URL: full HR Admin first-day workflow (invite supervisor, invite executive, deactivate, reassign)
- [ ] Smoke test on preview URL: practice supervisor → Enterprise upgrade via /admin/orgs auto-promotes to HR Admin (+ welcome email lands)
- [ ] Smoke test on preview URL: supervisor reassignment closes old supervisor_assignment row, opens new one with transferred_from_supervisor_id; prior signed sessions still attribute to original signer
- [ ] Smoke test on preview URL: executive role redirects /dashboard → /dashboard/executive; /dashboard/roster returns 302 to /dashboard/executive
- [ ] Smoke test on preview URL: HR Admin uploads HRIS CSV (use template from /dashboard/team/import), preview flags 1 intentional error, fix CSV, commit, verify invitation emails arrive
- [ ] Audit log CSV export TOTP-gated; verify download succeeds for HR Admin, fails without TOTP

**Already on main:**
- [x] Lead-magnet PDF wording softened
- [x] Sitemap updated for /founding

**External dependencies (no merge block — done in parallel):**
- [ ] Stripe `founding_supervisor_lifetime` coupon created + test promo verified (Damon)
- [ ] Resend `RESEND_FOUNDING_AUDIENCE_ID` + `RESEND_LEAD_MAGNETS_AUDIENCE_ID` set on Vercel (Damon)
- [ ] At least one licensed LCMHCS has read the audit checklist PDF for accuracy
- [ ] MS Entra ID app registration (blocks Teams + Calendar work — see docs/strategy/06-ms-integrations.md)
- [ ] Merge.dev account (blocks HRIS Phase 2 + 3 — see docs/strategy/05-hris-integration.md)
