import { test, expect } from "@playwright/test";
import { loginAsDemo, getDemoCreds } from "../helpers/login";

/**
 * Hostile RBAC checks against PROD.
 *
 * For each (low-priv role → high-priv URL) pair, the app must respond
 * with a redirect OR a 403 OR a notFound — NEVER a 500, NEVER a 200
 * with partial data of the high-priv surface.
 *
 * Per docs/strategy/11-demo-readiness-test-plan.md §Part 2b.
 */

const MANAGER_ONLY_URLS = [
  "/dashboard/team",
  "/dashboard/team/rules",
  "/dashboard/audit-log",
];

test.describe("Supervisee → manager-only routes", () => {
  test.skip(
    () => !getDemoCreds("supervisee"),
    "DEMO_SUPERVISEE_* env vars not set"
  );

  for (const url of MANAGER_ONLY_URLS) {
    test(`${url} redirects or 403s, never renders manager content`, async ({
      page,
    }) => {
      await loginAsDemo(page, "supervisee");
      const resp = await page.goto(url);
      const finalUrl = page.url();

      // Two acceptable shapes:
      //   1. Server-side redirect away from the URL (Next 16 redirect()).
      //   2. Status 403 / 404 on the URL itself.
      // Hard-fail on 500 or on rendering the manager surface (which we
      // detect by looking for the manager-specific CTAs).
      const status = resp?.status() ?? 0;
      expect(status, `${url} must not 5xx`).toBeLessThan(500);

      const stayedOnRoute = finalUrl.includes(url);
      if (stayedOnRoute && status === 200) {
        // If we somehow stayed on a 200 page, fail if the manager CTAs
        // surfaced — that would indicate an information leak.
        await expect(
          page.getByRole("link", { name: /customize state rules/i })
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: /export audit log/i })
        ).toHaveCount(0);
      }
    });
  }
});

test.describe("Supervisor → HR-Admin-only routes", () => {
  test.skip(
    () => !getDemoCreds("supervisor"),
    "DEMO_SUPERVISOR_* env vars not set"
  );

  test("/dashboard/team/rules — supervisor cannot reach (HR Admin only)", async ({
    page,
  }) => {
    await loginAsDemo(page, "supervisor");
    const resp = await page.goto("/dashboard/team/rules");
    const status = resp?.status() ?? 0;
    expect(status, "must not 5xx").toBeLessThan(500);
    // canManageOrg() gates this surface — supervisor must not see the
    // "Customize" CTA which exists only on the rules-admin page.
    const finalUrl = page.url();
    if (finalUrl.includes("/dashboard/team/rules")) {
      await expect(
        page.getByRole("link", { name: /customize state rules/i })
      ).toHaveCount(0);
    }
  });
});

test.describe("Logged-out → authenticated routes", () => {
  for (const url of [
    "/dashboard",
    "/dashboard/roster",
    "/dashboard/team",
    "/dashboard/audit-log",
  ]) {
    test(`${url} → /login (no dashboard flash, no 500)`, async ({ page }) => {
      const resp = await page.goto(url);
      const status = resp?.status() ?? 0;
      expect(status).toBeLessThan(500);
      // Should land on /login after the server-side redirect.
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
