/**
 * One-off: screenshot specific authenticated URLs (reuses cached supervisor
 * storage state) in light + dark. Usage:
 *   node scripts/screenshots/shoot-url.mjs <role> <name>=<path> [<name>=<path> ...]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = "http://app.localhost:3000";
const role = process.argv[2];
const targets = process.argv.slice(3).map((a) => {
  const [name, ...rest] = a.split("=");
  return { name, path: rest.join("=") };
});
const statePath = resolve(REPO, "playwright/.auth", `${role}.json`);

const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const dir = resolve(REPO, "scripts/tmp/shots/url", theme, role);
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    colorScheme: theme,
    storageState: statePath,
  });
  if (theme === "dark") await ctx.addCookies([{ name: "ah-theme", value: "dark", url: BASE }]);
  const page = await ctx.newPage();
  for (const t of targets) {
    await page.goto(`${BASE}${t.path}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/${t.name}.png`, fullPage: true });
    console.log(`${theme}/${t.name}`);
  }
  await ctx.close();
}
await browser.close();
