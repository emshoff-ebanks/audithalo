/**
 * Inline login helper for the demo-readiness specs (2026-06-15+).
 *
 * The existing e2e/auth.setup.ts works against the seeded e2e-* accounts
 * and writes storage state to playwright/.auth/. The demo specs need to
 * exercise login itself (it's on the customer demo path), and they target
 * the damon-test-* accounts whose passwords were freshly rotated by
 * scripts/reset-demo-passwords.ts. Each demo spec calls loginAsDemo()
 * directly instead of relying on the saved storage state.
 */

import { Page, expect } from "@playwright/test";

export type DemoRole = "hr_admin" | "supervisor" | "supervisee";

const ENV_KEYS: Record<DemoRole, { email: string; password: string }> = {
  hr_admin: { email: "DEMO_HR_ADMIN_EMAIL", password: "DEMO_HR_ADMIN_PASSWORD" },
  supervisor: { email: "DEMO_SUPERVISOR_EMAIL", password: "DEMO_SUPERVISOR_PASSWORD" },
  supervisee: { email: "DEMO_SUPERVISEE_EMAIL", password: "DEMO_SUPERVISEE_PASSWORD" },
};

export function getDemoCreds(role: DemoRole): { email: string; password: string } | null {
  const keys = ENV_KEYS[role];
  const email = process.env[keys.email];
  const password = process.env[keys.password];
  if (!email || !password) return null;
  return { email, password };
}

export async function loginAsDemo(page: Page, role: DemoRole): Promise<void> {
  const creds = getDemoCreds(role);
  if (!creds) {
    throw new Error(
      `Missing ${ENV_KEYS[role].email} / ${ENV_KEYS[role].password}. ` +
        `Run scripts/reset-demo-passwords.ts --apply and paste the env block ` +
        `into .env.local.`
    );
  }
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  // Land on /dashboard (or a role-specific dashboard route).
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}
