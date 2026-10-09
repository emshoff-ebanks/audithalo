import { test, expect } from "@playwright/test";

// Executive role is read-only oversight. Since the v2 redesign the org
// rollup (AdminOverview) lives on /dashboard itself, so an Executive lands
// there, manager-only routes like /dashboard/roster bounce back to it, and
// the old /dashboard/executive URL redirects to it. This proves the
// route-level guard fires (not just the nav-level hiding).

test.use({ storageState: "playwright/.auth/executive.json" });

test("executive lands on the /dashboard overview", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("executive is redirected from /dashboard/roster to /dashboard", async ({
  page,
}) => {
  await page.goto("/dashboard/roster");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("legacy /dashboard/executive redirects to /dashboard", async ({ page }) => {
  await page.goto("/dashboard/executive");
  await expect(page).toHaveURL(/\/dashboard$/);
  // Page renders content (no 500). The overview has org-wide rollup
  // metrics — at minimum a heading should be visible.
  await expect(page.getByRole("heading").first()).toBeVisible();
});
