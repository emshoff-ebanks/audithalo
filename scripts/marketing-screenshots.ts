/**
 * Marketing screenshot capture — logs into the demo org and snaps the key
 * supervisor + supervisee pages at desktop and mobile dimensions. Output
 * lands in /screenshots (gitignored).
 *
 * Prereqs (one-time):
 *   npm install -D playwright
 *   npx playwright install chromium
 *
 * Workflow:
 *   1. npm run seed:demo    (populates demo-supervisor + 3 supervisees)
 *   2. npm run dev          (in another terminal — script hits localhost:3000)
 *   3. npm run screenshots
 *
 * Override the app URL with APP_URL=... npm run screenshots if you'd rather
 * hit a preview deploy.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type PlaywrightModule = typeof import("playwright");

async function loadPlaywright(): Promise<PlaywrightModule> {
  try {
    return (await import("playwright")) as PlaywrightModule;
  } catch {
    console.error(
      "[screenshots] playwright is not installed. Run:\n" +
        "  npm install -D playwright\n" +
        "  npx playwright install chromium"
    );
    process.exit(1);
  }
}

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const OUT_DIR = join(process.cwd(), "screenshots");
const DEMO_PASSWORD = "Demo1234!";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const SUPERVISOR_EMAIL = "demo-supervisor@audithalo.com";
const SUPERVISEE_EMAILS = {
  jamie: "demo-supervisee1@audithalo.com",
  morgan: "demo-supervisee2@audithalo.com",
  riley: "demo-supervisee3@audithalo.com",
};

type Page = Awaited<
  ReturnType<Awaited<ReturnType<PlaywrightModule["chromium"]["launch"]>>["newPage"]>
>;
type BrowserContext = Awaited<
  ReturnType<Awaited<ReturnType<PlaywrightModule["chromium"]["launch"]>>["newContext"]>
>;
type Browser = Awaited<ReturnType<PlaywrightModule["chromium"]["launch"]>>;

async function preflight() {
  const res = await fetch(APP_URL).catch(() => null);
  if (!res) {
    console.error(
      `[screenshots] cannot reach ${APP_URL}. Is \`npm run dev\` running in another terminal?`
    );
    process.exit(1);
  }
}

async function login(page: Page, email: string) {
  await page.goto(`${APP_URL}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', DEMO_PASSWORD);
  await Promise.all([
    page.waitForURL((u) => u.pathname.startsWith("/dashboard"), {
      timeout: 30_000,
    }),
    page.click('button[type="submit"]'),
  ]);
  // Give RSC streams a beat to settle.
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function shot(
  page: Page,
  name: string,
  opts: { fullPage?: boolean } = {}
) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // Small extra delay to let any in-flight animations finish (toasts,
  // skeleton fades, etc.).
  await page.waitForTimeout(400);
  const path = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
  console.log(`  ✓ ${name}.png`);
}

/**
 * Pull the supervisee UUIDs off the roster page so we don't have to hardcode
 * them (the seed assigns random UUIDs on each reset).
 */
async function getRosterIds(page: Page): Promise<Map<string, string>> {
  await page.goto(`${APP_URL}/dashboard/roster`);
  await page.waitForLoadState("networkidle").catch(() => {});
  const links = page.locator('a[href^="/dashboard/roster/"]');
  const count = await links.count();
  const result = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const href = await link.getAttribute("href");
    const text = ((await link.textContent()) ?? "").toLowerCase();
    if (!href) continue;
    const id = href.split("/").pop()!;
    if (text.includes("jamie")) result.set("jamie", id);
    else if (text.includes("morgan")) result.set("morgan", id);
    else if (text.includes("riley")) result.set("riley", id);
  }
  return result;
}

async function captureSupervisor(
  browser: Browser,
  viewport: typeof DESKTOP,
  suffix: string
) {
  console.log(`\n[${suffix}] supervisor pass`);
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await login(page, SUPERVISOR_EMAIL);

  await shot(page, `${suffix}-supervisor-dashboard`, {
    fullPage: suffix === "desktop",
  });

  const ids = await getRosterIds(page);
  await shot(page, `${suffix}-supervisor-roster`, { fullPage: true });

  for (const [name, id] of ids) {
    await page.goto(`${APP_URL}/dashboard/roster/${id}`);
    await shot(page, `${suffix}-supervisee-detail-${name}`, { fullPage: true });
  }

  await page.goto(`${APP_URL}/dashboard/account`);
  await shot(page, `${suffix}-supervisor-account`, { fullPage: true });

  await page.goto(`${APP_URL}/dashboard/billing`);
  await shot(page, `${suffix}-supervisor-billing`);

  await page.goto(`${APP_URL}/dashboard/audit-log`);
  await shot(page, `${suffix}-supervisor-audit-log`);

  await ctx.close();
}

async function captureSupervisee(
  browser: Browser,
  viewport: typeof DESKTOP,
  suffix: string,
  who: keyof typeof SUPERVISEE_EMAILS
) {
  console.log(`\n[${suffix}] supervisee pass (${who})`);
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await login(page, SUPERVISEE_EMAILS[who]);

  await shot(page, `${suffix}-supervisee-${who}-dashboard`, { fullPage: true });

  await ctx.close();
}

async function main() {
  await preflight();
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log(`[screenshots] capturing against ${APP_URL}`);
  console.log(`[screenshots] output → ${OUT_DIR}`);

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    // Supervisor: snapshot everything they see on desktop + mobile.
    await captureSupervisor(browser, DESKTOP, "desktop");
    await captureSupervisor(browser, MOBILE, "mobile");

    // Supervisee: snapshot Jamie (65% progress — the most photogenic) and
    // Riley (95% — closest to ready-to-license) for variety.
    await captureSupervisee(browser, DESKTOP, "desktop", "jamie");
    await captureSupervisee(browser, DESKTOP, "desktop", "riley");
    await captureSupervisee(browser, MOBILE, "mobile", "jamie");
  } finally {
    await browser.close();
  }

  console.log(`\n[screenshots] done. ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
