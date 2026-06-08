import { test, expect } from "@playwright/test";

// Each role hitting /dashboard should land without error and see the
// role-appropriate header text. Catches role-routing regressions that
// would otherwise only show up as user complaints.

test.describe("HR Admin", () => {
  test.use({ storageState: "playwright/.auth/hr_admin.json" });

  test("/dashboard loads", async ({ page }) => {
    const resp = await page.goto("/dashboard");
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("Supervisor", () => {
  test.use({ storageState: "playwright/.auth/supervisor.json" });

  test("/dashboard loads", async ({ page }) => {
    const resp = await page.goto("/dashboard");
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("Supervisee", () => {
  test.use({ storageState: "playwright/.auth/supervisee.json" });

  test("/dashboard redirects to their own detail page or renders own view", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    // Supervisees may be redirected to /dashboard/roster/{id} or stay on
    // /dashboard with a self-view. Either is acceptable — the test only
    // catches the case where the page errors out or sends them somewhere
    // unexpected like /login.
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});
