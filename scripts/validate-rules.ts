/**
 * Build-time YAML rule validation.
 *
 * Wired into `npm run build` as a prebuild step (see package.json). The rule
 * loader (src/lib/rules/loader.ts) already throws on any YAML file that fails
 * Zod validation — this script just calls it eagerly so a broken rule file
 * crashes the deploy instead of the first request that touches the rule
 * catalog in production.
 *
 * Without this, a malformed key in rules/ca-apcc/v1.yaml would compile fine
 * and 500 the dashboard for every CA APCC supervisor the next time the
 * Vercel function cold-started.
 */
import { loadAllRules } from "../src/lib/rules/loader";

try {
  const rules = loadAllRules();
  console.log(`[validate-rules] ok — ${rules.size} rule version(s) loaded`);
  for (const id of [...rules.keys()].sort()) {
    console.log(`  • ${id}`);
  }
} catch (err) {
  console.error("[validate-rules] FAILED");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
