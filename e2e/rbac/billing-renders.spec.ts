import { test, expect } from "@playwright/test";

// /dashboard/billing is supervisor + hr_admin only (manager roles).
// Supervisees and executives redirect to /dashboard.

test.describe("HR Admin", () => {
  test.use({ storageState: "playwright/.auth/hr_admin.json" });

  test("can load /dashboard/billing", async ({ page }) => {
    const resp = await page.goto("/dashboard/billing");
    expect(resp?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/dashboard\/billing/);
    // The org is on Enterprise (test seed) — page should show the
    // "contract" badge variant and not the upgrade form.
    await expect(page.getByText(/contract/i).first()).toBeVisible();
  });
});

test.describe("Supervisor", () => {
  test.use({ storageState: "playwright/.auth/supervisor.json" });

  test("can load /dashboard/billing", async ({ page }) => {
    const resp = await page.goto("/dashboard/billing");
    expect(resp?.status()).toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe("Supervisee", () => {
  test.use({ storageState: "playwright/.auth/supervisee.json" });

  test("hitting /dashboard/billing redirects to dashboard", async ({ page }) => {
    await page.goto("/dashboard/billing");
    // Non-managers should land somewhere other than the billing page.
    await expect(page).not.toHaveURL(/\/dashboard\/billing/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
