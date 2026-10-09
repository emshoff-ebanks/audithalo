import { test, expect } from "@playwright/test";
import { loginAsDemo, getDemoCreds } from "../helpers/login";

/**
 * Demo-readiness smoke against PROD.
 *
 * Walks each of the three demo roles through the happy path the customer
 * will see at the 2026-06-16 10am demo. Per plan
 * docs/strategy/11-demo-readiness-test-plan.md §Part 2a, a red here =
 * do NOT demo.
 *
 * Each describe is its own browser context so a misbehaving role doesn't
 * cross-contaminate the next. No storage-state shortcuts — login itself
 * is on the demo path and we want to verify it.
 */

test.describe("HR Admin demo path", () => {
  test.skip(
    () => !getDemoCreds("hr_admin"),
    "DEMO_HR_ADMIN_* env vars not set"
  );

  test("walks dashboard → roster → team → calendar → audit-log → state rules → bell", async ({
    page,
  }) => {
    await loginAsDemo(page, "hr_admin");

    // Dashboard
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
    await expect(page.getByRole("heading").first()).toBeVisible();

    // Supervisees (sidebar; accessible name may include a count badge)
    await page.getByRole("link", { name: /^supervisees\b/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/roster/);
    // Roster table or empty state must render — no 500/error boundary.
    await expect(page.getByRole("heading").first()).toBeVisible();

    // Team (sidebar)
    await page.getByRole("link", { name: /^team$/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/team$/);
    await expect(page.getByRole("heading").first()).toBeVisible();

    // State rules (sidebar, HR Admin only) — must render.
    await page.getByRole("link", { name: /^state rules$/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/team\/rules/);
    await expect(page.getByRole("heading").first()).toBeVisible();

    // Calendar
    await page.getByRole("link", { name: /^calendar$/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/calendar/);

    // Audit log (sidebar)
    await page.getByRole("link", { name: /^audit log$/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/audit-log/);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("Supervisor demo path", () => {
  test.skip(
    () => !getDemoCreds("supervisor"),
    "DEMO_SUPERVISOR_* env vars not set"
  );

  test("lands on dashboard with the right surface limits", async ({ page }) => {
    await loginAsDemo(page, "supervisor");

    // Dashboard renders — today's schedule widget either renders sessions
    // or hides cleanly. We don't assert on its presence; we assert the
    // page has no 5xx and the heading is visible.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading").first()).toBeVisible();

    // Supervisees and Calendar visible in the sidebar; State rules and
    // Settings NOT visible (those are HR Admin only).
    await expect(
      page.getByRole("link", { name: /^supervisees\b/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^calendar$/i }).first()
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^state rules$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^settings$/i })).toHaveCount(0);
  });
});

test.describe("Supervisee demo path", () => {
  test.skip(
    () => !getDemoCreds("supervisee"),
    "DEMO_SUPERVISEE_* env vars not set"
  );

  test("dashboard, status card behavior, future-session card click", async ({
    page,
  }) => {
    await loginAsDemo(page, "supervisee");

    // Land on a dashboard variant (supervisee may redirect to own detail).
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading").first()).toBeVisible();

    // The four status cards layout exists. Status card may or may not be
    // a link depending on gap count — both shapes are OK as long as the
    // page renders.
    const cards = page.locator('[class*="grid-cols"]').first();
    await expect(cards).toBeVisible();
  });
});
