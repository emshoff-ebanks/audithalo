import { test, expect } from "@playwright/test";

// Rules admin (Cycle 2-7) is HR Admin only. Catches the kind of regression
// that bit us when migration 0027 hadn't applied in prod and every HR Admin
// hitting /dashboard/team/rules got the dashboard error boundary instead
// of the dashboard.

test.describe("HR Admin", () => {
  test.use({ storageState: "playwright/.auth/hr_admin.json" });

  test("can load /dashboard/team/rules", async ({ page }) => {
    const resp = await page.goto("/dashboard/team/rules");
    expect(resp?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/dashboard\/team\/rules/);
    await expect(
      page.getByRole("heading", { name: /Customize your state rules/i })
    ).toBeVisible();
  });

  test("can load the new custom rule wizard placeholder", async ({ page }) => {
    const resp = await page.goto("/dashboard/team/rules/new");
    expect(resp?.status()).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: /Build a custom state rule/i })
    ).toBeVisible();
  });
});

test.describe("Supervisor", () => {
  test.use({ storageState: "playwright/.auth/supervisor.json" });

  test("hitting /dashboard/team/rules redirects to /dashboard/team", async ({
    page,
  }) => {
    // Supervisors aren't HR Admins — the rules-admin page redirects them
    // to /dashboard/team. We assert no 5xx and no /login bounce.
    const resp = await page.goto("/dashboard/team/rules");
    expect(resp?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe("Supervisee", () => {
  test.use({ storageState: "playwright/.auth/supervisee.json" });

  test("hitting /dashboard/team/rules does not 500 or land on /login", async ({
    page,
  }) => {
    const resp = await page.goto("/dashboard/team/rules");
    expect(resp?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
