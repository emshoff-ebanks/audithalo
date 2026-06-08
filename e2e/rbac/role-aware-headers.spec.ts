import { test, expect } from "@playwright/test";

// Verifies the role-aware roster page header from the recent UX fix:
//   - HR Admin sees "Org roster" + org-wide framing
//   - Supervisor sees "Your roster" + invite-centric framing
// Also confirms the role badge in the header reflects the logged-in role.

test.describe("HR Admin", () => {
  test.use({ storageState: "playwright/.auth/hr_admin.json" });

  test("sees 'Org roster' header on /dashboard/roster", async ({ page }) => {
    await page.goto("/dashboard/roster");
    await expect(
      page.getByRole("heading", { name: /org roster/i })
    ).toBeVisible();
  });

  test("header badge shows 'HR Admin'", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/^HR Admin$/i).first()).toBeVisible();
  });
});

test.describe("Supervisor", () => {
  test.use({ storageState: "playwright/.auth/supervisor.json" });

  test("sees 'Your roster' header on /dashboard/roster", async ({ page }) => {
    await page.goto("/dashboard/roster");
    await expect(
      page.getByRole("heading", { name: /your roster/i })
    ).toBeVisible();
  });

  test("header badge shows 'Supervisor'", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/^Supervisor$/i).first()).toBeVisible();
  });
});
