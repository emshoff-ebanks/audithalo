/**
 * Heuristic fact-drift check for blog content.
 *
 * This is NOT a substitute for a human re-deriving every claim from source —
 * it's a cheap, fast net that catches the two costliest classes of mistake at
 * zero review cost: (1) a post citing a state we have no rules/ file for at
 * all (the "confidently wrote about Oregon" trap), and (2) a specific
 * quantity (hour totals, ratios, percentages) that doesn't appear anywhere in
 * the rules/ YAML for any state the post claims to be about — a strong signal
 * the number was recalled from memory rather than read off the source.
 *
 * A number NOT being found is a prompt to go check it by hand, not proof it's
 * wrong (a legitimate derived figure, a product stat, or a citation section
 * number can also fail to match). This script only fails the run (exit 1) on
 * the unambiguous class of error — an unsupported state. Number mismatches
 * are printed as warnings for a human to verify; run it before every publish.
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "src", "content", "blog");
const RULES_DIR = path.join(process.cwd(), "rules");

// Numbers that recur in template/product boilerplate and are not state-rule
// facts. Extend this list when a new false positive shows up.
const DENYLIST = new Set(["256"]);

function loadRuleRawText(slug: string): string | null {
  const dir = path.join(RULES_DIR, slug);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  if (files.length === 0) return null;
  return files
    .map((f) => fs.readFileSync(path.join(dir, f), "utf-8"))
    .join("\n");
}

function extractFactTokens(text: string): string[] {
  const ratios = text.match(/\b\d{1,3}:\d{1,3}\b/g) ?? [];
  const percents = text.match(/\b\d{1,3}%/g) ?? [];
  const bigNumbers = (text.match(/\b\d{1,3}(?:,\d{3})+\b|\b[1-9]\d{2,}\b/g) ?? [])
    .filter((n) => {
      const digits = n.replace(/,/g, "");
      const asNum = Number(digits);
      const isYear = digits.length === 4 && asNum >= 1900 && asNum <= 2099;
      return !isYear && !DENYLIST.has(digits);
    });
  return Array.from(new Set([...ratios, ...percents, ...bigNumbers]));
}

function main() {
  if (!fs.existsSync(BLOG_DIR)) {
    console.log("[validate-blog-facts] no blog content directory yet — skipping");
    return;
  }

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
  let hasErrors = false;
  let warningCount = 0;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf-8");
    const { data, content } = matter(raw);
    const relatedStates: string[] = data.relatedStates ?? [];

    if (relatedStates.length === 0) continue;

    const sourceTexts: string[] = [];
    for (const slug of relatedStates) {
      const ruleText = loadRuleRawText(slug);
      if (!ruleText) {
        console.error(
          `[validate-blog-facts] ERROR ${file}: relatedStates references "${slug}" but rules/${slug}/ has no yaml file. Do not publish state-specific claims with no source of truth.`
        );
        hasErrors = true;
        continue;
      }
      sourceTexts.push(ruleText);
    }
    if (sourceTexts.length === 0) continue;

    const combinedSource = sourceTexts.join("\n");
    const claimedFacts = extractFactTokens(content);
    const missing = claimedFacts.filter((token) => !combinedSource.includes(token));

    if (missing.length > 0) {
      warningCount += missing.length;
      console.warn(
        `[validate-blog-facts] WARN ${file}: not found in rules/${relatedStates.join(", rules/")} — verify by hand: ${missing.join(", ")}`
      );
    }
  }

  console.log(
    `[validate-blog-facts] checked ${files.length} post(s), ${warningCount} number(s) to verify manually.`
  );

  if (hasErrors) process.exit(1);
}

main();
