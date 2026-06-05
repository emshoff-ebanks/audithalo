import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import yaml from "js-yaml";
import { ruleSchema, type Rule, ruleId } from "./types";

// Path resolution: rules live at the repo root in /rules.
// In Vercel deploys this directory must be included via outputFileTracingIncludes.
const RULES_DIR = resolve(process.cwd(), "rules");

// In-memory cache so we parse each YAML file once per server lifetime.
let registry: Map<string, Rule> | null = null;

/**
 * Loads every rule YAML under /rules/ and returns the typed registry.
 * Throws if any file fails Zod validation — better to crash on boot than ship a broken rule.
 */
export function loadAllRules(): Map<string, Rule> {
  if (registry) return registry;

  const rules = new Map<string, Rule>();

  for (const slug of readdirSync(RULES_DIR)) {
    const dir = join(RULES_DIR, slug);
    if (!statSync(dir).isDirectory()) continue;

    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
      const path = join(dir, file);
      const raw = readFileSync(path, "utf8");
      const parsed = yaml.load(raw);
      const result = ruleSchema.safeParse(parsed);
      if (!result.success) {
        throw new Error(
          `Invalid rule at ${path}: ${JSON.stringify(result.error.issues, null, 2)}`
        );
      }
      rules.set(ruleId(result.data), result.data);
    }
  }

  registry = rules;
  return rules;
}

/**
 * Looks up a specific rule version by jurisdiction + license code + version.
 * Throws if not found — callers should be passing rule IDs that already exist.
 */
export function getRule(
  jurisdiction: string,
  licenseCode: string,
  version: number
): Rule {
  const all = loadAllRules();
  const id =
    `${jurisdiction}-${licenseCode}-v${version}`.toLowerCase();
  const rule = all.get(id);
  if (!rule) throw new Error(`Rule not found: ${id}`);
  return rule;
}

/** Lists the rule IDs currently loaded. */
export function listRuleIds(): string[] {
  return [...loadAllRules().keys()];
}

/** URL slug for a rule (jurisdiction-license_code, lowercase). Versionless. */
export function ruleSlug(jurisdiction: string, licenseCode: string): string {
  return `${jurisdiction}-${licenseCode}`.toLowerCase();
}

/** Parse a slug back into jurisdiction + license code. */
export function parseSlug(
  slug: string
): { jurisdiction: string; licenseCode: string } | null {
  const m = slug.match(/^([a-z]{2})-(.+)$/i);
  if (!m) return null;
  return {
    jurisdiction: m[1].toUpperCase(),
    licenseCode: m[2].toUpperCase(),
  };
}

/** Returns the latest-version rule for a jurisdiction + license_code pair. */
export function getLatestRuleByJurLic(
  jurisdiction: string,
  licenseCode: string
): Rule | null {
  const matches = [...loadAllRules().values()].filter(
    (r) =>
      r.jurisdiction.toUpperCase() === jurisdiction.toUpperCase() &&
      r.license_code.toUpperCase() === licenseCode.toUpperCase()
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.version - a.version)[0];
}

/**
 * Parse a stored ruleId (e.g. "nc-lcmhca-v1") into its components. Returns
 * null on shapes we don't recognize so callers can fail-safe.
 *
 * jurisdiction is the 2-letter state code; license_code allows hyphens
 * (e.g. "lpc-associate") and the version is the trailing v{N}.
 */
export function parseRuleId(
  ruleId: string
): { jurisdiction: string; licenseCode: string; version: number } | null {
  const match = /^([a-z]{2})-(.+)-v(\d+)$/i.exec(ruleId);
  if (!match) return null;
  return {
    jurisdiction: match[1].toUpperCase(),
    licenseCode: match[2].toUpperCase(),
    version: parseInt(match[3], 10),
  };
}

/**
 * Returns the latest available rule version number for a (jurisdiction,
 * license) pair, or null if no rules exist for that pair.
 */
export function latestVersionForState(
  jurisdiction: string,
  licenseCode: string
): number | null {
  const latest = getLatestRuleByJurLic(jurisdiction, licenseCode);
  return latest?.version ?? null;
}

/** All distinct (jurisdiction, license_code) pairs currently encoded, each pointing at the latest version. */
export function listLatestRules(): Rule[] {
  const byKey = new Map<string, Rule>();
  for (const r of loadAllRules().values()) {
    const key = ruleSlug(r.jurisdiction, r.license_code);
    const existing = byKey.get(key);
    if (!existing || existing.version < r.version) {
      byKey.set(key, r);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.jurisdiction.localeCompare(b.jurisdiction)
  );
}
