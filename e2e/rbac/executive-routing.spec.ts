import { test, expect } from "@playwright/test";

// Executive role is read-only oversight. Per
// docs/strategy/04-enterprise-rbac.md §"Edge cases" #6, an Executive
// hitting /dashboard or /dashboard/roster should land at
// /dashboard/executive instead. This proves the route-level guard
// fires (not just the nav-level hiding).

test.use({ storageState: "playwright/.auth/executive.json" });

test("executive lands on /dashboard/executive when hitting /dashboard", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard\/executive$/);
});

test("executive is redirected from /dashboard/roster to /dashboard/executive", async ({
  page,
}) => {
  await page.goto("/dashboard/roster");
  await expect(page).toHaveURL(/\/dashboard\/executive$/);
});

test("executive can reach /dashboard/executive directly", async ({ page }) => {
  await page.goto("/dashboard/executive");
  await expect(page).toHaveURL(/\/dashboard\/executive$/);
  // Page renders content (no 500). The exec dashboard has practice-wide
  // rollup metrics — at minimum a heading should be visible.
  await expect(page.getByRole("heading").first()).toBeVisible();
});
