-- 0027: Org rule overrides + custom org-authored rules.
--
-- Adds the storage layer for the two-tier rule model spec'd in
-- docs/strategy/09-rules-admin.md:
--
--   Tier 1 (canonical) — rules/*.yaml, untouched by this migration.
--   Tier 2 (org overrides) — this table.
--
-- One row models either:
--   (a) an override on a canonical rule (canonical_rule_id IS NOT NULL),
--       e.g. "our NC LCMHCA override tightens the supervision ratio,"
--   or
--   (b) a custom org-authored rule (canonical_rule_id IS NULL),
--       for states we haven't shipped canonical YAML for yet.
--
-- The resolver in src/lib/rules/overrides.ts decides which branch to take
-- based on whether canonical_rule_id is null. The evaluator never sees the
-- difference — it gets a fully-merged Rule object either way.

CREATE TABLE IF NOT EXISTS "org_rule_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL
    REFERENCES "organizations"("id") ON DELETE CASCADE,

  -- For an override: the canonical rule id this row layers on top of
  --   (e.g. "nc-lcmhca-v1"). Must match an entry in the YAML registry at
  --   resolve time — validated in the action layer, not the schema.
  -- For a custom rule: NULL, and the org owns the full rule definition.
  "canonical_rule_id" text,

  -- Always populated. For overrides this duplicates canonical values so
  -- list views don't need to crack the canonical YAML. For custom rules
  -- the org supplies them via the builder wizard.
  "jurisdiction" char(2) NOT NULL,
  "license_code" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "label" text NOT NULL,

  -- For overrides: partial RuleStructured — merged on top of canonical at
  --   resolve time. {} = no structural deviation, just check-param edits.
  -- For custom rules: the full RuleStructured block.
  "structured_patch" jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- For overrides: { add: RuleCheck[], remove: string[],
  --                  replace_params: Record<checkId, params> }.
  --   Each field optional. Empty object = no check-level changes.
  -- For custom rules: { checks: RuleCheck[] } — the canonical-shaped list.
  "checks_patch" jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Custom-rule-only metadata: self-supplied citation + summary + verified
  -- date. NULL for overrides (canonical's metadata applies).
  "custom_metadata" jsonb,

  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid NOT NULL
    REFERENCES "users"("id"),
  "last_edited_by" uuid
    REFERENCES "users"("id")
);

-- Hot path: the resolver looks up active overrides for an org by canonical
-- rule id. Partial index keeps it tight — most rows are active.
CREATE INDEX IF NOT EXISTS "org_rule_overrides_org_canonical_active_idx"
  ON "org_rule_overrides" ("org_id", "canonical_rule_id")
  WHERE "is_active";

-- Used by the team-page rules dashboard listing.
CREATE INDEX IF NOT EXISTS "org_rule_overrides_org_active_idx"
  ON "org_rule_overrides" ("org_id")
  WHERE "is_active";

-- Enforce: at most one ACTIVE override per (org, canonical) — preventing
-- two HR Admins from racing two active rows. Inactive rows stack freely
-- for audit history (a deactivate + re-author flow).
CREATE UNIQUE INDEX IF NOT EXISTS "org_rule_overrides_one_active_per_canonical_idx"
  ON "org_rule_overrides" ("org_id", "canonical_rule_id")
  WHERE "is_active" AND "canonical_rule_id" IS NOT NULL;

-- Enforce: at most one ACTIVE custom rule per (org, jurisdiction, license,
-- version) tuple. Custom rules with canonical_rule_id IS NULL form their
-- own uniqueness namespace via the (jurisdiction, license_code, version)
-- triple. Reauthoring a custom rule deactivates the old row.
CREATE UNIQUE INDEX IF NOT EXISTS "org_rule_overrides_one_active_custom_idx"
  ON "org_rule_overrides" ("org_id", "jurisdiction", "license_code", "version")
  WHERE "is_active" AND "canonical_rule_id" IS NULL;
