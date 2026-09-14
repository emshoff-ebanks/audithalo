/**
 * Capture help-center screenshots from the seeded Atlas demo org.
 *
 * Staged to reflect the documented action: navigates to the right supervisee,
 * fills forms (WITHOUT submitting), and screenshots the relevant region so each
 * shot shows real, action-appropriate data rather than an empty state.
 *
 * Read-only except the opt-in 2FA-QR shot (starts a TOTP setup, which writes a
 * harmless pending secret on the demo HR-admin account).
 *
 * Credentials come from .env.local (DEMO_*), loaded by playwright.config.ts.
 *
 * Run: CAPTURE_DOCS_SHOTS=1 E2E_BASE_URL=http://app.localhost:3000 \
 *      npx playwright test e2e/docs-screenshots.spec.ts --project=docs-screenshots
 * Output: public/docs-screenshots/*.png
 */
import { test, expect, type Page, type Locator } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "https://app.audithalo.com";
const OUT = "public/docs-screenshots";
const CAPTURE_2FA = !!process.env.CAPTURE_2FA; // opt-in: writes a pending secret

const CREDS = {
  hrAdmin: {
    email: process.env.DEMO_HR_ADMIN_EMAIL!,
    password: process.env.DEMO_HR_ADMIN_PASSWORD!,
  },
  supervisor: {
    email: process.env.DEMO_SUPERVISOR_EMAIL!,
    password: process.env.DEMO_SUPERVISOR_PASSWORD!,
  },
  executive: {
    email: process.env.DEMO_EXECUTIVE_EMAIL!,
    password: process.env.DEMO_EXECUTIVE_PASSWORD!,
  },
  supervisee: {
    email: process.env.DEMO_SUPERVISEE_EMAIL!,
    password: process.env.DEMO_SUPERVISEE_PASSWORD!,
  },
};

test.use({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "light",
});

async function login(page: Page, who: keyof typeof CREDS) {
  const { email, password } = CREDS[who];
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

async function goto(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

/** Screenshot the viewport (top of page) or a located element if given. */
async function shot(page: Page, name: string, target?: Locator) {
  await page.waitForTimeout(600);
  if (target) {
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await target.screenshot({ path: `${OUT}/${name}.png` });
  } else {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  }
  console.log(`captured ${name}`);
}

/** Run a capture, logging (not throwing) on failure so the run continues. */
async function tryShot(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.log(`SKIPPED ${name}: ${(err as Error).message.split("\n")[0]}`);
  }
}

/** Open a supervisee detail page by visible name from the roster. */
async function openSupervisee(page: Page, name: string) {
  await goto(page, "/dashboard/roster");
  await page.getByText(name, { exact: false }).first().click();
  await page.waitForURL("**/dashboard/roster/**", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

test("hr admin shots", async ({ page }) => {
  await login(page, "hrAdmin");

  await tryShot("roster-status", async () => {
    await goto(page, "/dashboard/roster");
    await shot(page, "roster-status");
  });

  await tryShot("team-invite", async () => {
    await goto(page, "/dashboard/team");
    await shot(page, "team-invite");
  });

  await tryShot("rule-override-editor", async () => {
    await goto(page, "/dashboard/team/rules");
    await shot(page, "rules-admin");
  });

  await tryShot("audit-log", async () => {
    await goto(page, "/dashboard/audit-log");
    await shot(page, "audit-log");
  });

  await tryShot("billing-tiers", async () => {
    await goto(page, "/dashboard/billing");
    await shot(page, "billing-tiers");
  });

  await tryShot("account-security", async () => {
    await goto(page, "/dashboard/account");
    await shot(page, "account-page");
  });

  if (CAPTURE_2FA) {
    await tryShot("account-2fa", async () => {
      await goto(page, "/dashboard/account");
      await page.getByRole("button", { name: /enable two-factor/i }).click();
      await page.waitForTimeout(1500);
      await shot(page, "account-2fa");
    });
  }
});

test("supervisor shots", async ({ page }) => {
  await login(page, "supervisor");

  await tryShot("detail-emily", async () => {
    await openSupervisee(page, "Emily");
    await shot(page, "supervisee-detail");
  });

  await tryShot("log-session-form", async () => {
    await openSupervisee(page, "Emily");
    await page.getByRole("button", { name: /log session/i }).first().click();
    await page.waitForTimeout(600);
    await page.selectOption('select[name="kind"]', "supervision").catch(() => {});
    await page.fill('input[name="durationHours"]', "1").catch(() => {});
    await page.selectOption('select[name="sessionType"]', "individual").catch(() => {});
    await shot(page, "log-session-form");
  });

  await tryShot("assign-rule-form", async () => {
    await openSupervisee(page, "Emily");
    await page
      .getByRole("button", { name: /assign rule|change rule/i })
      .first()
      .click();
    await page.waitForTimeout(600);
    await shot(page, "assign-rule-form");
  });

  await tryShot("detail-sofia-gaps", async () => {
    await openSupervisee(page, "Sofia");
    await shot(page, "compliance-gaps");
  });

  await tryShot("calendar-week", async () => {
    await goto(page, "/dashboard/calendar");
    await shot(page, "calendar-week");
  });
});

test("executive shots", async ({ page }) => {
  await login(page, "executive");
  await tryShot("exec-dashboard", async () => {
    await goto(page, "/dashboard/executive");
    await shot(page, "executive-dashboard");
  });
});

test("unauth shots", async ({ page }) => {
  await tryShot("register-form", async () => {
    await page.goto(`${BASE}/register`);
    await page.waitForLoadState("networkidle");
    await page.fill('input[name="name"]', "Jordan Reyes, LCMHCS").catch(() => {});
    await page.fill('input[name="email"]', "jordan@example.com").catch(() => {});
    await shot(page, "register-form");
  });
});
