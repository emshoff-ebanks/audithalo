import { test, expect, devices } from "@playwright/test";
import { loginAsDemo, getDemoCreds } from "../helpers/login";

/**
 * iPhone-15 viewport smoke for the customer demo (2026-06-16). Per plan
 * §Part 2f, the goal isn't pixel-perfect visual regression — it's:
 *   - every demo page returns < 400
 *   - no JS console errors
 *   - no horizontal overflow on the body
 *   - the primary CTA is in view without horizontal scroll
 */

test.use({ ...devices["iPhone 15"] });

test.describe("Mobile smoke (iPhone 15)", () => {
  test.skip(
    () => !getDemoCreds("hr_admin"),
    "DEMO_HR_ADMIN_* env vars not set"
  );

  test("HR Admin dashboard renders cleanly on iPhone 15", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await loginAsDemo(page, "hr_admin");

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading").first()).toBeVisible();

    // No horizontal overflow on body.
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    expect(overflow, "body must not overflow horizontally").toBe(false);

    // Console clean. Sentry/PostHog stub warnings may appear; filter to
    // outright errors only.
    const hardErrors = consoleErrors.filter(
      (e) => !/posthog|sentry|favicon/i.test(e)
    );
    expect(hardErrors, `unexpected console errors: ${hardErrors.join("\n")}`).toHaveLength(0);
  });

  test("HR Admin roster page renders cleanly on iPhone 15", async ({ page }) => {
    await loginAsDemo(page, "hr_admin");
    const resp = await page.goto("/dashboard/roster");
    expect(resp?.status() ?? 0).toBeLessThan(400);
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    expect(overflow, "roster must not overflow horizontally").toBe(false);
  });

  test("State rules page renders cleanly on iPhone 15", async ({ page }) => {
    await loginAsDemo(page, "hr_admin");
    const resp = await page.goto("/dashboard/team/rules");
    expect(resp?.status() ?? 0).toBeLessThan(400);
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    expect(overflow, "rules-admin must not overflow horizontally").toBe(false);
  });
});

test.describe("Mobile smoke — supervisee dashboard", () => {
  test.skip(
    () => !getDemoCreds("supervisee"),
    "DEMO_SUPERVISEE_* env vars not set"
  );

  test("supervisee dashboard + this-week widget on iPhone 15", async ({
    page,
  }) => {
    await loginAsDemo(page, "supervisee");
    await expect(page).not.toHaveURL(/\/login/);
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    expect(overflow, "supervisee dashboard must not overflow").toBe(false);
  });
});
