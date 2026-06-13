# Data-freshness audit

> Started 2026-06-12 in response to a recurring pattern: a user edits
> something in one place, and a downstream view keeps showing the old
> value. Three known instances so far:
> 1. Display name changed in /dashboard/account, stale in JWT-rendered
>    headers and emails until session refresh.
> 2. Supervisee's assigned state rule changed, but the rule label on the
>    supervisee detail page (and some children) showed the prior rule
>    until a full refresh.
> 3. Org-rule override (e.g. 3000 → 3001 hours) saved cleanly but the
>    supervisee compliance math kept using canonical. Fixed in 2026-06-12
>    (`29464a8`) but the audit revealed how many downstream surfaces
>    were silently canonical-only.
>
> This doc inventories every user-editable surface in the app, every
> downstream view that depends on it, and the freshness mechanism that
> keeps the two in sync. The point is to surface places where the link
> is implicit, brittle, or missing.

## Methodology

For each editable surface:

1. **What gets edited.** The form / action and the columns it writes.
2. **Where the edit is read.** All UI surfaces that display the value.
3. **Freshness mechanism.** What keeps the read in sync — RSC revalidation,
   JWT refresh on next login, derived projection on each render, etc.
4. **Known stale risks.** Cached projections, denormalized labels, JWT
   payload, email previews — anything that could lag.

When a row in this table says "no automatic propagation," that's an
**audit finding** to track — the user has to log out, click refresh, or
wait for the next cron tick. Acceptable in some cases (e.g. the next
audit-log export run); a bug in others (e.g. a label rendered on a page
the user is currently on).

## 1. User profile (display name, email, license info)

| Field | Edit surface | Action | Read surfaces |
|---|---|---|---|
| `users.name` | `/dashboard/account` | `updateProfileAction` | Header greeting, supervisee dashboard, roster table, supervisee detail "primary supervisor" line, audit log "actor", email greetings, sealed PDF "Supervisee" / "Supervisor" cells |
| `users.email` | `/dashboard/account` (rare) | `updateProfileAction` | Same as above when name is null; audit log when actorUserId is null |
| `users.state` / `licenseType` | Onboarding only; not editable post-onboarding | n/a | Roster table column, supervisee detail metadata, marketing state-page targeting |
| `users.autoApplyRuleUpdates` | `/dashboard/account` | `updateAutoApplyRuleUpdatesAction` | Only read inside the rule-drift cron — no UI surface |
| `users.twoFactor*` | `/dashboard/settings` | TOTP setup actions | Settings page only |

**Freshness mechanism.** The `users` row is read fresh per RSC render —
no in-memory cache. But the **JWT** payload encodes `session.user.name`
and `session.user.email`, which is what the header chrome and some
middleware checks read. The JWT is rotated only on login or token
refresh. So a display-name edit:

- **Updates immediately**: the supervisee dashboard greeting (RSC reads
  `users.name` direct), the audit log "actor" column (reads `users.name`
  via join), the sealed PDF generator (snapshots at seal time).
- **Lags until next login**: the header chrome (reads JWT), the
  `signRuleChangedEmail` "Hi {name}" greeting if triggered between edits
  and re-login, anywhere `session.user.name` is rendered.

**Audit finding F1.** Header chrome reads stale `session.user.name`
post-edit. Fix: force a JWT refresh inside `updateProfileAction` (NextAuth
supports this via `auth().update()`), or change the header to read from
the DB row. Commit `59acbc6` already attempted a partial fix here —
verify it covers all callers.

**Audit finding F2.** Emails sent after a name change but before re-login
will quote the old name. Lower priority — emails are async + rare.

## 2. Org settings (org name, branding, default time zone)

| Field | Edit surface | Action | Read surfaces |
|---|---|---|---|
| `organizations.name` | `/dashboard/settings` | `updateOrgSettingsAction` | Team page h1, sealed PDF "Organization" row, invite emails ("X joined Acme") |
| Org branding (logo, primary color) | `/dashboard/settings` | `updateOrgSettingsAction` | Sealed PDF header, invite email header |
| Default time zone | `/dashboard/settings` | `updateOrgSettingsAction` | Scheduling modal defaults, calendar event display |

**Freshness mechanism.** Same RSC-fresh pattern. The PDF generator
snapshots the org name at seal time — that's intentional.

**Audit finding F3.** Invite emails sent shortly after an org-name
change may quote the old name (the email is composed inside an action;
if it pulled `org.name` before the rename, it'd be stale). Low impact.

## 3. Org memberships (roles, deactivations)

| Field | Edit surface | Action | Read surfaces |
|---|---|---|---|
| `org_memberships.role` | `/dashboard/team` (HR Admin only) | `changeMemberRoleAction` | Every authz check, role badges, sidebar nav |
| `org_memberships.deactivatedAt` | `/dashboard/team` | `deactivateMemberAction` | Member rows, login flow, roster inclusion, supervisor-assignment validity |
| `supervisor_assignments` rows | `/dashboard/roster/[id]` (reassign supervisor) | `reassignSupervisorAction` | Supervisee detail "primary supervisor", calendar visibility for new supervisor, email routing for session events |

**Freshness mechanism.** Role lives in the JWT (`session.user.role`). A
role change does NOT auto-refresh the JWT — the user keeps their old
role until they sign out and back in. The DB row updates, so server-side
authz checks via `getCurrentMembership` are correct, but middleware and
client-side conditional rendering use the JWT.

**Audit finding F4.** Promoting a supervisor to HR Admin doesn't grant
the new menu items until they log out. This was bitten before (commit
`b8484d7` enforced a JWT-vs-membership sync check). Worth verifying that
check still trips and we surface a "please sign back in" hint.

**Audit finding F5.** Deactivating a member doesn't immediately log them
out — their existing JWT stays valid until expiry. NextAuth has session
callbacks that can be used to terminate active sessions; we don't use
them. Compliance-sensitive: a fired employee retains app access until
their session expires.

## 4. Rule assignments + attestations

| Field | Edit surface | Action | Read surfaces |
|---|---|---|---|
| `supervisee_rule_assignments.ruleId` | Supervisee detail "Change rule" | `assignRuleAction` | Supervisee detail, supervisee dashboard, roster table, executive dashboard, supervisor dashboard, evidence PDF (snapshotted) |
| `supervisee_rule_assignments.obligationStartedAt` | `assignRuleAction` (inline) | `assignRuleAction` | All compliance evaluation; permit-window math; the obligation-start banner |
| `supervisionContractFiledAt` | Attestation gap "Mark contract as filed" | `attestAction` | `pre_registration_required` check, supervisee dashboard, completed-attestations list |
| `supervisorTrainingCompletedAt`, `supervisorTrainingHoursAttested` | Attestation gap | `attestAction` | `supervisor_training_course_required` check, completed-attestations list |
| `permitIssuedAt`, `permitExpiresAt` | Attestation gap | `attestAction` | `permit_expiration_window` check |
| `attestations` (jsonb bag) | Same | `attestAction` for unknown checkIds | `_completed-attestations.tsx`, audit trail |

**Freshness mechanism.** All RSC-direct. The attestation action calls
`revalidatePath` on `/dashboard/roster/[superviseeId]` and `/dashboard`.
The client form calls `router.refresh()` after the action returns.

**Audit finding F6.** Resolved 2026-06-12 (`29464a8`). The roster page,
supervisee detail page, executive dashboard, and supervisor dashboard
all called `resolveEvaluation` (canonical-only) instead of
`resolveEvaluationWithOverrides`. Org overrides looked saved but never
affected the compliance math. The fix wired the override-aware resolver
through all five surfaces.

**Audit finding F7.** Resolved 2026-06-12 (`29464a8`). `mergeOverride`
only patched `rule.structured`, but the evaluator reads
`check.params.*`. The two are duplicated in YAML. Tightening a structured
field never reached the evaluator. Fixed via `STRUCTURED_TO_CHECK_PARAM`
propagation.

**Audit finding F8.** Resolved 2026-06-12 (this doc's commit). The
`pre_registration_required` check returned an `attestation` action even
when the contract was already filed and the gap was specifically about
pre-filing sessions. Re-submitting the form silently no-op'd. Fixed by
switching to `data_correction` action (points at offending sessions) in
that branch.

## 5. State rules (canonical YAML)

| Field | Edit surface | Action | Read surfaces |
|---|---|---|---|
| `rules/*.yaml` | git PR only (super-admin) | next deploy | All rule-version banners, marketing state pages, evidence PDF, evaluator, override editor, custom-rule wizard's "canonical exists" guard |

**Freshness mechanism.** YAML is bundled into the deploy and parsed at
first import via `loadAllRules()` which caches forever. A new canonical
version is invisible until the next deploy.

**Audit finding F9.** When a new canonical ships, the version-drift
banner picks it up automatically next render. The `RuleVersionBanner`
extended in Cycle 6 offers re-author. **Confirmed working.**

## 6. Org rule overrides + custom rules (Cycle 1–7)

| Field | Edit surface | Action | Read surfaces |
|---|---|---|---|
| `org_rule_overrides.structuredPatch` | Override editor | `upsertCanonicalOverrideAction` | All five compliance surfaces (above), rules dashboard diff, history page |
| `org_rule_overrides.checksPatch` | Same | Same | Same |
| `org_rule_overrides.customMetadata` | Custom-rule wizard | `createCustomRuleAction` | Custom-rule detail page, supervisee dashboard when assigned, "org-created" badge |
| `org_rule_overrides.isActive` | "Deactivate" buttons | `deactivateOverrideAction` | Compliance surfaces revert to canonical; history page keeps the row |

**Freshness mechanism.** All actions call `revalidatePath`. RSC
re-renders on next request. Co-admin email fires on save/deactivate.

**Audit finding F10.** ~~Roster-table compliance numbers~~ — fixed.

**Audit finding F11.** Evidence PDF snapshots the canonical rule, not
the override-merged rule. This is intentional (state boards see canonical)
but worth confirming with Damon that's the desired behavior — the alternative
is to snapshot the merged rule with an "internal override" annotation
in the metadata.

## 7. Sessions (logged events)

| Field | Edit surface | Action | Read surfaces |
|---|---|---|---|
| `session_events.*` | Log Session form, Schedule modal | `logSessionAction`, `scheduleSessionAction` | Calendar, supervisee dashboard, roster compliance, evidence PDF, signature flow |
| `session_events.signedAt` | Sign page | `signSessionAction` | Compliance counters, sealed PDFs |
| `session_events.scheduledStatus` | Calendar / Cancel button | `cancelScheduledSessionAction`, `markSessionNoShowAction` | Calendar, supervisee dashboard "needs sig" filter (Cycle 8 fix) |

**Freshness mechanism.** All RSC-direct. Calendar's `_session-drawer.tsx`
uses optimistic UI for cancel actions.

**Audit finding F12.** Resolved 2026-06-12. The "Needs your signature"
list on the supervisee dashboard included future scheduled sessions —
not yet signable, actively misleading. Filter now excludes
`scheduledStatus="scheduled"` and any event with a future date.

## 8. Billing + subscription (Stripe)

| Field | Edit surface | Action | Read surfaces |
|---|---|---|---|
| Subscription tier | Stripe Checkout | Stripe webhook | Billing page, paywall guards, seat limits |
| Seat count | HR Admin invites | invitation flow + Stripe quantity update | Billing page |
| Founding-supervisor status | Admin grant | admin action | `users.foundingSupervisor` flag |

**Freshness mechanism.** Stripe webhook updates `organizations.subscription_*`
fields; RSC reads them fresh.

**Audit finding F13.** Stripe webhook delivery delay (typically <2 s but
can stretch to 30+ s under load). User clicks "Subscribe" → Stripe
processes → user lands back on /billing → may see "no subscription" until
webhook lands. Mitigated by Stripe's redirect including a confirmation
parameter — verify our /billing page reads it.

## 9. Calendar integrations (OAuth)

| Field | Edit surface | Action | Read surfaces |
|---|---|---|---|
| `user_calendar_integrations.*` | OAuth connect on /dashboard/account | OAuth callback | Schedule modal "provider" dropdown, integrations panel |

**Freshness mechanism.** OAuth callback writes the row, redirects to
account page which RSC-reads.

**Audit finding F14.** Disconnecting an integration doesn't cancel
already-scheduled meetings — they still try to use the disconnected
provider on the next reminder cron. Low priority; affects very few users.

## Cross-cutting recommendations

1. **Add JWT auto-refresh on `updateProfileAction` and
   `changeMemberRoleAction`.** Eliminates findings F1 and F4. Pattern:
   call `auth().update()` after the DB write, document in code that the
   update is intentional.

2. **Adopt a denormalization-free rule.** Don't store labels in JSONB
   bags when the source-of-truth column exists. Audit `users.name`,
   `organizations.name`, `rule.label` for places where we cached a copy.

3. **Standardize on the override-aware resolver everywhere.** Today the
   non-override `resolveEvaluation` still exists in
   `src/lib/rules/evaluation-context.ts` for tests + the marketing site.
   Inside `/dashboard/*` it should not be importable. Add an ESLint rule
   that disallows the import outside `/marketing` and `/lib/rules/__tests__`.

4. **Belt-and-braces for evaluation reads.** When the same value lives
   in two places in the canonical YAML (structured + check params), the
   evaluator should resolve to a single source. Either change the
   evaluator to read `rule.structured.*` first and fall back to params,
   or formalize the propagation table (`STRUCTURED_TO_CHECK_PARAM` in
   `src/lib/rules/overrides.ts`) as the canonical mapping. Today it's a
   patch-time concern; ideally it's a load-time invariant.

5. **End-to-end test for every edit→read pair.** The Cycle-7 RBAC spec
   covers role-based access but not freshness. A new spec — edit the
   user's name, render the header, assert the new name — would catch
   F1 immediately. Worth adding one per audit finding above.

6. **Pin RSC vs JWT boundary in code review.** When a PR touches the
   header chrome or a place that reads `session.user.*`, the reviewer
   should ask: "what edit would invalidate this read?" The answer is
   sometimes "the JWT is fine" (e.g. `session.user.id`) and sometimes
   "we need to read from the DB."

## Status legend
- **F1, F4, F5, F11, F13, F14**: known but not yet fixed.
- **F2, F3**: low impact, accepted.
- **F6, F7, F8, F10, F12**: fixed in 2026-06-12 commits.
- **F9**: confirmed working.
