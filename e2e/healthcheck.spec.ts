import { test, expect } from "@playwright/test";

// Read-only sanity tests. Safe to run against any environment — no auth,
// no mutations, no PII. If these go red, something fundamental broke.

test("login page renders with email + password fields", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/AuditHalo/i);
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});

test("register page renders", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading")).toBeVisible();
});

test("marketing homepage renders", async ({ page }) => {
  // Marketing lives on a different host. Absolute URL bypasses baseURL.
  await page.goto("https://audithalo.com");
  await expect(page).toHaveTitle(/AuditHalo/i);
});
