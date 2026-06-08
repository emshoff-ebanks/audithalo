import { test, expect } from "@playwright/test";

// Audit log is HR Admin + Executive. Supervisor/Supervisee should NOT
// see the full org audit log — they get redirected.

test.describe("HR Admin", () => {
  test.use({ storageState: "playwright/.auth/hr_admin.json" });

  test("can load /dashboard/audit-log", async ({ page }) => {
    const resp = await page.goto("/dashboard/audit-log");
    expect(resp?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/dashboard\/audit-log/);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("Supervisor", () => {
  test.use({ storageState: "playwright/.auth/supervisor.json" });

  test("hitting /dashboard/audit-log does not error", async ({ page }) => {
    // Supervisor may get redirected away or see a limited view. Either way
    // the page shouldn't 500 or send them to /login.
    const resp = await page.goto("/dashboard/audit-log");
    expect(resp?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
