import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Auth setup runs ONCE per CI run. For each role, log in as the configured
// test user and save the resulting storage state (cookies + localStorage) to
// disk. Each spec can then start with that storage state and skip the login
// flow entirely. Massive speedup + avoids hammering the auth surface.
//
// ACTIVATION: this file is currently NOT wired into playwright.config.ts as
// a setup project — wire it in only after the test users + env vars are
// provisioned per docs/strategy/07-e2e-testing.md §"Required test users".
//
// Until then, the healthcheck spec continues to run without auth (read-only
// against any environment).

const STORAGE_DIR = "playwright/.auth";

type RoleSetup = {
  role: "hr_admin" | "supervisor" | "supervisee" | "executive";
  emailEnv: string;
  passwordEnv: string;
};

const ROLES: RoleSetup[] = [
  { role: "hr_admin", emailEnv: "E2E_HR_ADMIN_EMAIL", passwordEnv: "E2E_HR_ADMIN_PASSWORD" },
  { role: "supervisor", emailEnv: "E2E_SUPERVISOR_EMAIL", passwordEnv: "E2E_SUPERVISOR_PASSWORD" },
  { role: "supervisee", emailEnv: "E2E_SUPERVISEE_EMAIL", passwordEnv: "E2E_SUPERVISEE_PASSWORD" },
  { role: "executive", emailEnv: "E2E_EXECUTIVE_EMAIL", passwordEnv: "E2E_EXECUTIVE_PASSWORD" },
];

mkdirSync(dirname(`${STORAGE_DIR}/sentinel`), { recursive: true });

for (const { role, emailEnv, passwordEnv } of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const email = process.env[emailEnv];
    const password = process.env[passwordEnv];

    // Fail loudly per Principle #6 — never silently skip a role.
    if (!email || !password) {
      throw new Error(
        `Missing credentials for ${role}: set ${emailEnv} + ${passwordEnv}. ` +
          `See docs/strategy/07-e2e-testing.md §"Required test users".`
      );
    }

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Wait for redirect to a post-login page (dashboard or role-specific landing).
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await page.context().storageState({ path: `${STORAGE_DIR}/${role}.json` });
  });
}
