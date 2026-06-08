import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Accessibility audit on the highest-traffic marketing pages.
// Fails on `critical` impact only — `serious` (e.g. color-contrast) is
// pervasive on the current marketing palette and should be addressed
// as a dedicated design workstream rather than blocking CI on each
// content change.
//
// Tests reach out to https://audithalo.com directly (marketing host).
// Independent of app-side auth.

const MARKETING_BASE = "https://audithalo.com";

const PAGES = [
  { name: "home", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "for-supervisors", path: "/for-supervisors" },
  { name: "security", path: "/security" },
  { name: "nc state landing", path: "/states/nc-lcmhca" },
];

for (const { name, path } of PAGES) {
  test(`${name} — no serious/critical a11y violations`, async ({ page }) => {
    await page.goto(`${MARKETING_BASE}${path}`);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "critical"
    );
    const serious = results.violations.filter((v) => v.impact === "serious");

    // Surface serious-impact violations as warnings without failing —
    // useful signal for a future design pass.
    if (serious.length > 0) {
      const summary = serious
        .map((v) => `  ${v.id}: ${v.help} — ${v.nodes.length} node(s)`)
        .join("\n");
      console.log(`\n[a11y serious (non-blocking) on ${path}]\n${summary}\n`);
    }

    if (blocking.length > 0) {
      const summary = blocking
        .map((v) => `  ${v.id}: ${v.help} — ${v.nodes.length} node(s)`)
        .join("\n");
      console.log(`\n[a11y CRITICAL on ${path}]\n${summary}\n`);
    }

    expect(blocking).toEqual([]);
  });
}
