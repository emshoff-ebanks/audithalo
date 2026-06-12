# Rules administration — canonical YAML + org overrides + custom states

**Status:** Plan. No code written yet. Migration slot reserved: `0027`.

## Why this exists

State supervision rules are AuditHalo's moat. Today the system has exactly one editor: a super-admin opens a YAML file in `rules/<slug>/v<n>.yaml`, opens a PR, and ships a build. That is fine for the published, board-verified canonical rule but breaks down on three real-world cases the testing pass surfaced:

1. **An org wants to tighten a rule for internal policy.** Example: NC LCMHCA allows 1 hr individual supervision per 40 hrs practice, but a practice requires 1 per 20. The canonical rule should not change — other practices in NC are still under the looser standard — but this org's evaluator needs the tighter ratio.
2. **A state we haven't shipped yet.** A practice in a small state (e.g., WY, ND) opens an account before the canonical YAML exists. Today they're stuck. The product cannot say "we don't cover your state" if we want to charge them.
3. **The board updates its admincode mid-year.** A super-admin pushes a new canonical version (e.g., `nc-lcmhca-v2`). Orgs on v1 should be able to opt into v2 at their own pace without losing any internal-policy overrides they had on v1. This is the rule-version drift banner that already exists in `_rule-version-banner.tsx`, but with overrides it gets harder: an override is *bound to a canonical version*, not just a state.

Anything that gets in the way of those three flows is wrong.

## Two-tier model

There are exactly two tiers and they never blur:

- **Canonical rules** live in `rules/<slug>/v<n>.yaml`. Source of truth. Edited only via git PR by a super-admin. Validated by `scripts/validate-rules.ts` on `prebuild`. The board citation, last-verified date, and source URL on every rule come from here.
- **Org overrides** live in a new DB table (`org_rule_overrides`, see schema below). An HR Admin of an org can author, edit, deactivate them through the UI. Every override is bound to a specific canonical rule version and merges on top at evaluation time. Never edited via git.

A third concept exists only for case 2 above: **custom rules** — org-created rules where there is no canonical to override. Stored in the same `org_rule_overrides` table with `canonical_rule_id = null` and a self-supplied summary/citation set. Wear a different hat in the UI: "Build a custom state rule" instead of "Customize NC LCMHCA v1."

### Why two storage tiers instead of one

The naive temptation is to put everything in the DB so super-admins use the same UI as HR Admins. Rejected for three reasons:

1. **Reviewability**: every canonical rule change has been a YAML diff in a PR for a year. Damon, Caleb, and the eventual licensed-supervisor reviewer all know how to read that. Moving canonical rules into the DB loses git blame, PR review, and the prebuild validator.
2. **Compliance posture**: "the canonical rule lives in a versioned file with last-verified-by metadata and a board citation URL" is something we can defend to an auditor. "The canonical rule lives in a Postgres row that was last edited at 3am by someone with HR Admin in some random tenant" is not.
3. **Disaster recovery**: a corrupted DB can be restored from canonical YAML. A corrupted YAML can be restored from git. A corrupted single source has no escape hatch.

The override layer pays for itself the moment a single org needs case 1 above.

## The check template catalog (seven primitives)

Today the YAML check IDs are state-specific strings (`weekly_supervision_cadence`, `supervision_ratio_per_practice_block`, etc.). For canonical rules they stay that way — the IDs are the contract between the YAML and the evaluator code in `src/lib/rules/checks.ts`.

For **custom-state building** (case 2), HR Admins can't be expected to invent check IDs that the evaluator already understands. Instead they pick from seven generic templates that map onto the existing evaluator behavior:

| Template | Existing analogue | What HR Admin fills in |
|---|---|---|
| `total_hours` (data_accumulation) | `total_practice_hours`, `total_supervision_hours`, `direct_client_contact_minimum` | hours required, kind (practice/supervision/direct) |
| `supervision_ratio` | `supervision_ratio_per_practice_block`, `individual_supervision_minimum_share` | numerator/denominator (e.g., 1 supervision per 20 practice) |
| `cadence` (recurring_behavior) | `individual_supervision_cadence`, `weekly_supervision_cadence` | window (weekly/biweekly), min hours per window, threshold for "does this week count" |
| `group_cap` | `group_size_limit` | max attendees |
| `attestation` | `pre_registration_required`, `supervisor_training_course_required` | label, accepts hours? |
| `time_window` (time_warning) | `duration_window` | min months, max months |
| `permit_window` | `permit_expiration_window` | max months from issue |

Seven, no more. If a state needs an eighth, that's a signal we should ship it as a canonical rule and write a new evaluator function — not extend the custom-state form.

## Schema — migration 0027

```sql
CREATE TABLE org_rule_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- For an override on a canonical rule, the canonical rule id (e.g. "nc-lcmhca-v1").
  -- For a custom state rule, NULL — and the org owns the entire rule definition
  -- in the structured + checks JSONB columns below.
  canonical_rule_id   text,

  -- For custom rules: the (jurisdiction, license_code, version) tuple the org
  -- supplies. Always populated; for overrides it duplicates the canonical
  -- values so list views don't need to read both tables.
  jurisdiction    char(2) NOT NULL,
  license_code    text NOT NULL,
  version         int NOT NULL DEFAULT 1,
  label           text NOT NULL,                 -- "Our internal NC supervision policy"

  -- For overrides: merged on top of the canonical structured block.
  -- For custom rules: the whole structured block.
  structured_patch jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- For overrides: array of check edits keyed by canonical check id —
  --   { add: [...], remove: [...], replace_params: { check_id: { ...params } } }
  -- For custom rules: the full checks array.
  checks_patch    jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- For custom rules only: self-supplied citation + summary.
  custom_metadata jsonb,

  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL REFERENCES users(id),
  last_edited_by  uuid REFERENCES users(id),

  -- An org can have at most one ACTIVE override per (canonical_rule_id) pair,
  -- and at most one active custom rule per (jurisdiction, license_code, version)
  -- tuple. Inactive rows can stack for audit history.
  UNIQUE (org_id, canonical_rule_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_org_rule_overrides_org_active ON org_rule_overrides (org_id) WHERE is_active;
CREATE INDEX idx_org_rule_overrides_canonical ON org_rule_overrides (canonical_rule_id) WHERE is_active;
```

The `supervisee_rule_assignments.rule_id` column already points at canonical rule ids (e.g., `nc-lcmhca-v1`). To assign a custom rule, we store a synthetic id of the form `org:<orgId>:custom:<jurisdiction>-<license>-v<n>` — easily recognized by the resolver and never collides with canonical ids.

## Resolver

`src/lib/rules/loader.ts` currently reads YAML and returns canonical rules. The new resolver wraps it:

```
resolveRuleForAssignment(orgId, ruleId)
  → if ruleId starts with "org:<orgId>:custom:" → load custom rule from DB → return
  → else load canonical rule from YAML
       → look up active override for (orgId, canonical ruleId)
       → if none → return canonical
       → else merge structured_patch + checks_patch on top of canonical
              → return merged rule, tagged with `_overrideId` for the UI
```

The evaluator (`src/lib/rules/evaluator.ts`) doesn't change. It already accepts a `Rule` object and runs checks against logged events. As long as the resolver hands it a well-formed `Rule`, overrides are invisible to the evaluator.

The override-merge logic is small but easy to get wrong, so it lives in one place (`src/lib/rules/overrides.ts`) with exhaustive tests against the existing five rules.

## UI surface

### Where it lives

A new "State rules" card on `/dashboard/team` (per Caleb's preference for keeping admin surfaces consolidated, not a separate top-nav item). Card content depends on viewer:

- HR Admin → "Customize your state rules" button → `/dashboard/team/rules`
- Super admin → same button, plus a second "Review pending custom rules" link (post-launch, not in cycle 1)
- Everyone else → card hidden

### The rules dashboard (`/dashboard/team/rules`)

Three sections:

1. **Canonical rules in use by your org** — derived from the distinct `assignment.ruleId` set across all the org's active supervisees. For each: "Customize" button (creates/edits an override row). Empty state = "No rules assigned yet — go assign a state rule to a supervisee."
2. **Active overrides** — list of `org_rule_overrides where is_active and canonical_rule_id is not null`. Each row shows the canonical it overrides, who last edited, and a "View diff" + "Deactivate" affordance.
3. **Custom state rules** — list of `where canonical_rule_id is null`. Each row shows the (jurisdiction, license, version) tuple, who created it, and the count of supervisees currently assigned.

### The override editor (`/dashboard/team/rules/[canonicalRuleId]`)

Two columns. Left: the canonical rule as-shipped (read-only, with the citation + last-verified badge). Right: the override form, pre-filled with the canonical values so an HR Admin can edit in place. Save creates or updates the override row.

The form covers structured fields (`total_practice_hours_required` etc.) and the per-check params. Adding or removing checks is intentionally limited to the seven-template catalog — adding a non-template check ID would require evaluator code and is rejected with a friendly "this needs a canonical rule update — email info@audithalo.com" message.

### The custom-state builder (`/dashboard/team/rules/new`)

Wizard:

1. Pick jurisdiction (any 2-letter state code not already in the canonical set; if a canonical exists, redirect to "customize NC LCMHCA v1" instead).
2. Pick license code + a human label.
3. Fill the structured block.
4. Compose checks from the seven-template catalog. The form generates the corresponding `checks` array entries with canonical-compatible IDs (`custom_total_hours`, `custom_cadence`, etc.) so the evaluator can still run them.
5. Self-supply a board citation (admincode + URL). The form requires both — a custom rule without a real source URL is just guessing, which is the most dangerous failure mode.
6. Save creates the org_rule_override row with `canonical_rule_id = null` and the synthetic rule id.

### The "you might be incompliant" warning

Every entry point into the override editor or custom-state builder displays a banner copy-edited with Damon's input:

> Customizing a state rule changes how AuditHalo evaluates your supervisees' progress for *your org only*. If your custom values disagree with the actual board requirement, AuditHalo will not catch you. The canonical rule shown on the left is what we verified against the board's published code.

The warning copy is the cheapest insurance against the worst failure mode: an HR Admin who loosens a rule for convenience and turns supervisees ineligible for licensure.

## Use cases and how people might break this

(Caleb's explicit request — the walkthrough should consider how users might misuse the feature.)

1. **HR Admin loosens a rule because their supervisor doesn't like it.**
   Mitigation: warning banner + an audit-log entry on every override save (`org_rule_override.upserted`) with diff of the change. Plus the override editor always shows the canonical on the left, so the contrast is in the user's face.

2. **HR Admin creates a custom rule for a state that already has a canonical.**
   Mitigation: builder step 1 redirects to the override editor with a "this is already a real rule, customize it instead" toast. Hard-fail in the action if the canonical exists at save time.

3. **HR Admin builds a custom rule with fake citation URLs.**
   Mitigation: cycle-7 work — display the custom citation prominently on the supervisee page with an "Org-created rule — not board-verified" badge. Supervisees can see it.

4. **Canonical rule ships v2 while orgs are on a v1 override.**
   Mitigation: rule-version banner already shows drift. When an org clicks "Switch to v2", the override is *not* auto-carried — they're prompted to either (a) re-author against v2, or (b) accept canonical v2 as-is. The override row stays in the DB as inactive for audit history.

5. **HR Admin sets `total_supervision_hours_required = 0` so everyone passes.**
   Mitigation: schema validation in the action — `structured_patch` values can deviate from canonical, but the resolver still validates the *merged* `Rule` object against `ruleStructuredSchema`. Zero hours fails `z.number().positive()` and the save is rejected.

6. **HR Admin removes a `blocker`-severity check.**
   Mitigation: the override editor lets HR Admins downgrade `blocker` to `warning` (legitimate — they may not consider one of the board's stated rules a hard fail for their internal flow) but warns in red. Removing a check entirely is blocked for canonical overrides; only the custom-state builder can omit checks.

7. **HR Admin authors a custom rule for an org but then changes role to supervisor.**
   Mitigation: the role-change action doesn't touch override rows. The custom rule continues to apply to supervisees who were already assigned. Future HR Admins (or the previous one re-promoted) can edit it.

8. **An org with overrides has its subscription canceled.**
   Mitigation: overrides stay in the DB even after subscription cancellation. If they re-subscribe, their overrides come back. Hard-delete only on full org deletion (`ON DELETE CASCADE`).

9. **Two HR Admins of the same org edit the same override simultaneously.**
   Mitigation: optimistic concurrency via `updated_at` timestamp passed in the form, rejected on stale write. Surfaces "this was edited by someone else — refresh to see their changes" instead of silently overwriting.

10. **Custom rules and canonical rules collide on rule id.**
    Mitigation: the synthetic id format `org:<orgId>:custom:...` is guaranteed not to collide because canonical ids never contain a colon (validated in `rule-id.test.ts`).

## Cycle breakdown

Each cycle is one merge-able PR with passing build/tests. Caleb reviews between cycles. No half-finished UI ships.

### Cycle 1 — schema + bootstrap (no UI)

- `drizzle/0027_org_rule_overrides.sql` per the schema above
- Drizzle schema entries in `src/lib/db/schema/rules.ts`
- `src/lib/rules/overrides.ts` — `mergeOverride(canonical, override) → Rule` with tests
- Update `resolveRuleForAssignment` (or create it) to accept an `orgId` and look up overrides
- `src/lib/rules/loader.ts` — keep the YAML loader, just rename the public function so the resolver wraps it
- Update existing callsites of `loadAllRules()` to either still get canonical-only (for `/marketing/states/...`) or org-aware (for `/dashboard/...`).
- Zero UI in this cycle.
- Tests covering: no override (passthrough), structured override, check-param override, check addition, check removal, custom rule load.

### Cycle 2 — view-only rules dashboard

- `/dashboard/team/rules` page
- Section 1 (canonical in use), section 2 (overrides — empty), section 3 (custom — empty)
- "Customize" button → 501 placeholder for cycle 3
- "Create custom rule" link → 501 placeholder for cycle 4
- Team page card linking here

### Cycle 3 — override editor (canonical → override)

- `/dashboard/team/rules/[canonicalRuleId]` page
- Read-only canonical column on the left
- Pre-filled form on the right
- Save action with optimistic-concurrency token, structured-schema validation, audit log
- Warning banner copy
- Tests: override roundtrips through the resolver and reaches the evaluator

### Cycle 4 — custom-state builder

- `/dashboard/team/rules/new` wizard
- Seven-template check composer
- Citation requirements
- Assignment integration: the `AssignRuleForm` on supervisee pages now lists custom rules from the actor's org alongside canonical ones
- Tests: full lifecycle — create custom rule, assign to supervisee, evaluator runs on logged events

### Cycle 5 — deactivate + edit history

- "Deactivate" affordance on overrides + custom rules (inactive rows preserved for audit)
- Diff-view modal showing canonical vs override
- Audit-log query surface ("who edited the override and when") on a hover panel
- Edit history page for individual overrides

### Cycle 6 — version drift handling

- When canonical ships v2 of a rule that has active overrides, the `RuleVersionBanner` on supervisee pages now offers three choices: stay on v1+override, switch to canonical v2, switch to v2 and re-author override
- Re-author flow opens the override editor pre-filled with the v1 override values applied to the v2 canonical
- Tests cover all three branches

### Cycle 7 — polish + safety

- "Org-created rule — not board-verified" badge on supervisee detail when a custom rule is in use
- "Loosens X from canonical" diff summary on hover for override rows
- Email notification to all org HR Admins on override save (so two co-admins don't silently drift)
- E2E test through the whole flow

## Open questions for Caleb

1. **Custom rules across orgs**: should `/dashboard/admin/rules` give super-admins a view of every org's custom rules so we can see what states the market is asking for? (would inform which canonical to write next.) Default yes.
2. **Override expiry**: should we force-prompt HR Admins to re-review their overrides every N months? Default no for v1 — surfaces in cycle 7 if we see overrides going stale.
3. **Notification for canonical changes**: when a canonical rule ships a new version, do we email every org with an active override on the old version, or just rely on the in-app drift banner? Default banner-only — email feels noisy.
4. **Founding Supervisor program touch**: does the existence of org overrides affect the FS badging logic? Default no — FS counts canonical-rule activity.

## Out of scope (explicitly)

- A "marketplace" of community-contributed state rules — promote-to-canonical is a super-admin job, not a community job, because of the compliance liability.
- Rule diffs across canonical versions surfaced in the marketing site — internal-only.
- Editing canonical rules through the UI — never. Always git PR.
- Per-supervisee rule customization — overrides are org-scoped only. A supervisee with weird circumstances gets a real-world attestation (the existing attestation flow), not a personal rule.
