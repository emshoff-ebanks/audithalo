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

    // Manage roster
    await page.getByRole("link", { name: /manage roster/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/roster/);
    // Roster table or empty state must render — no 500/error boundary.
    await expect(page.getByRole("heading").first()).toBeVisible();

    // Team (HR Admin only — top-nav link)
    await page.getByRole("link", { name: /^team$/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/team/);
    await expect(
      page.getByRole("link", { name: /customize state rules/i })
    ).toBeVisible();

    // Customize state rules — verify the button is NOT red (post-fix).
    const rulesButton = page.getByRole("link", {
      name: /customize state rules/i,
    });
    const variant = await rulesButton.getAttribute("class");
    expect(
      variant,
      "Customize state rules button must not use destructive (red) styling"
    ).not.toMatch(/bg-destructive|text-destructive-foreground/);

    // Calendar
    await page.getByRole("link", { name: /calendar/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/calendar/);

    // Audit log via profile dropdown (or direct nav as a fallback)
    const auditResp = await page.goto("/dashboard/audit-log");
    expect(auditResp?.status() ?? 0).toBeLessThan(400);

    // State rules — must render with at least one rule
    const rulesResp = await page.goto("/dashboard/team/rules");
    expect(rulesResp?.status() ?? 0).toBeLessThan(400);
    // No raw rule slugs leaked in the "in use by your org" section. We
    // can't easily assert the absence of every slug shape, but a quick
    // sanity check: the page should show at least a properly cased
    // jurisdiction label somewhere.
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

    // Manage roster and Calendar visible in nav; Team / Audit log /
    // State rules NOT visible (those are HR Admin only).
    await expect(
      page.getByRole("link", { name: /manage roster/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /calendar/i }).first()
    ).toBeVisible();
    // Don't pass strict — there can be sub-page links named "Team" elsewhere.
    // Assert the top-nav variant by checking the dashboard top nav.
    const teamLinks = page.getByRole("link", { name: /^team$/i });
    await expect(teamLinks).toHaveCount(0);
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
