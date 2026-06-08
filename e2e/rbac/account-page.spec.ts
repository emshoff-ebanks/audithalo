import { test, expect } from "@playwright/test";

// /dashboard/account is reachable by every authenticated role and shows
// their basic profile. No role-specific gating beyond authentication.

const ROLES = ["hr_admin", "supervisor", "supervisee", "executive"] as const;

for (const role of ROLES) {
  test.describe(`Account page — ${role}`, () => {
    test.use({ storageState: `playwright/.auth/${role}.json` });

    test("renders without redirect to login", async ({ page }) => {
      const resp = await page.goto("/dashboard/account");
      expect(resp?.status()).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/login/);
      // Account page renders some form-ish content — an email or name field.
      await expect(page.getByLabel(/email/i).first()).toBeVisible();
    });
  });
}
