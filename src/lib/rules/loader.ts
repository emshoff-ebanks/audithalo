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
