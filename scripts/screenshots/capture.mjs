/**
 * Local screenshot harness for the app v2 redesign.
 *
 * Logs into the running dev server (localhost:3000, routes under /app) using the
 * DEMO_* accounts already present in .env.local, then captures every app route
 * for the requested role in light and/or dark mode.
 *
 *   node scripts/screenshots/capture.mjs [role] [theme] [outTag]
 *     role  = supervisor | hr_admin | supervisee | executive | all   (default all)
 *     theme = light | dark | both                                    (default both)
 *     outTag= subfolder under scripts/tmp/shots (default: "current")
 *
 * Read-only against the shared Neon DB: it only logs in and navigates. No writes.
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..", "..");

// --- load .env.local ---------------------------------------------------------
function loadEnv() {
  const raw = readFileSync(resolve(REPO, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}
const env = loadEnv();

// Drive through the host-based proxy (src/proxy.ts): app.localhost rewrites to
// /app/* internally while the URL bar stays clean (/dashboard, /sign/...), so
// usePathname() + unprefixed <Link href> match production exactly.
const BASE = process.env.BASE_URL ?? "http://app.localhost:3000";

const CREDS = {
  supervisor: { email: env.DEMO_SUPERVISOR_EMAIL, password: env.DEMO_SUPERVISOR_PASSWORD },
  hr_admin: { email: env.DEMO_HR_ADMIN_EMAIL, password: env.DEMO_HR_ADMIN_PASSWORD },
  supervisee: { email: env.DEMO_SUPERVISEE_EMAIL, password: env.DEMO_SUPERVISEE_PASSWORD },
  executive: { email: env.DEMO_EXECUTIVE_EMAIL, password: env.DEMO_EXECUTIVE_PASSWORD },
};

// Routes to capture per role. Dynamic ids (roster detail, sign) are discovered.
const ROUTES = {
  supervisor: [
    ["dashboard", "/dashboard"],
    ["roster", "/dashboard/roster"],
    ["calendar", "/dashboard/calendar"],
    ["team", "/dashboard/team"],
    ["rules", "/dashboard/team/rules"],
    ["billing", "/dashboard/billing"],
    ["account", "/dashboard/account"],
    ["audit-log", "/dashboard/audit-log"],
  ],
  hr_admin: [
    ["dashboard", "/dashboard"],
    ["roster", "/dashboard/roster"],
    ["calendar", "/dashboard/calendar"],
    ["team", "/dashboard/team"],
    ["team-import", "/dashboard/team/import"],
    ["rules", "/dashboard/team/rules"],
    ["rules-new", "/dashboard/team/rules/new"],
    ["executive", "/dashboard/executive"],
    ["billing", "/dashboard/billing"],
    ["settings", "/dashboard/settings"],
    ["settings-integrations", "/dashboard/settings/integrations"],
    ["account", "/dashboard/account"],
    ["audit-log", "/dashboard/audit-log"],
  ],
  supervisee: [
    ["dashboard", "/dashboard"],
    ["calendar", "/dashboard/calendar"],
    ["account", "/dashboard/account"],
  ],
  executive: [
    ["executive", "/dashboard/executive"],
    ["calendar", "/dashboard/calendar"],
    ["audit-log", "/dashboard/audit-log"],
    ["account", "/dashboard/account"],
  ],
};

async function login(page, role) {
  const c = CREDS[role];
  if (!c?.email || !c?.password) throw new Error(`Missing DEMO creds for ${role}`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', c.email);
  await page.fill('input[name="password"]', c.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
}

async function shoot(page, theme, dir, name, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(700);
  const path = `${dir}/${name}.png`;
  await page.screenshot({ path, fullPage: true }).catch((e) => console.warn("  ! shot failed", name, e.message));
  console.log(`  ${theme}/${name}`);
}

async function captureRole(browser, role, theme, outTag) {
  const dir = resolve(REPO, "scripts/tmp/shots", outTag, theme, role);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  // Real dark-mode path: seed the ah-theme cookie the shell reads server-side.
  if (theme === "dark") {
    await context.addCookies([
      { name: "ah-theme", value: "dark", url: BASE },
    ]);
  }
  const page = await context.newPage();
  page.on("pageerror", (e) => console.warn(`  [pageerror ${role}]`, e.message));

  console.log(`\n== ${role} · ${theme} ==`);
  await login(page, role);

  const routes = [...ROUTES[role]];

  // Discover a supervisee detail + sign page for roles that have a roster.
  if (role === "supervisor" || role === "hr_admin") {
    await page.goto(`${BASE}/dashboard/roster`, { waitUntil: "networkidle" });
    const href = await page
      .locator('a[href*="/dashboard/roster/"]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    if (href) {
      const detail = href.replace(/^https?:\/\/[^/]+/, "");
      routes.push(["supervisee-detail", detail]);
      await page.goto(`${BASE}${detail}`, { waitUntil: "networkidle" });
      const signHref = await page
        .locator('a[href*="/sign/"]')
        .first()
        .getAttribute("href")
        .catch(() => null);
      if (signHref) routes.push(["sign", signHref.replace(/^https?:\/\/[^/]+/, "")]);
    }
  }

  for (const [name, url] of routes) await shoot(page, theme, dir, name, url);
  await context.close();
}

async function main() {
  const roleArg = process.argv[2] ?? "all";
  const themeArg = process.argv[3] ?? "both";
  const outTag = process.argv[4] ?? "current";
  const roles = roleArg === "all" ? Object.keys(CREDS) : [roleArg];
  const themes = themeArg === "both" ? ["light", "dark"] : [themeArg];

  const browser = await chromium.launch();
  try {
    for (const theme of themes) {
      for (const role of roles) {
        try {
          await captureRole(browser, role, theme, outTag);
        } catch (e) {
          console.error(`FAILED ${role}/${theme}:`, e.message);
        }
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\nDone → scripts/tmp/shots/${outTag}/`);
}

main();
