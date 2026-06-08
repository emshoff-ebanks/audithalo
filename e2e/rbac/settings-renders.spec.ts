import { test, expect } from "@playwright/test";

// /dashboard/settings is HR-Admin-only org settings (retention years,
// SSO, branding). Other roles should be redirected away.

test.describe("HR Admin", () => {
  test.use({ storageState: "playwright/.auth/hr_admin.json" });

  test("can load /dashboard/settings", async ({ page }) => {
    const resp = await page.goto("/dashboard/settings");
    expect(resp?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("Supervisor", () => {
  test.use({ storageState: "playwright/.auth/supervisor.json" });

  test("hitting /dashboard/settings redirects or returns without error", async ({
    page,
  }) => {
    const resp = await page.goto("/dashboard/settings");
    expect(resp?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
