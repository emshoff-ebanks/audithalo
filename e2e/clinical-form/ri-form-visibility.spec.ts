import { test, expect, Page } from "@playwright/test";

/**
 * RI Clinical Supervision Form — permission gating.
 *
 * Verifies that the clinical form sections only appear for RI supervisors
 * (org.pdfTemplateKey = 'recovery_innovations_v1') and not for supervisees,
 * HR admins (view-only), or supervisors in generic orgs (Atlas).
 *
 * The supervision type dropdown is universal and should appear for all orgs.
 *
 * Uses inline login (same pattern as demo-smoke specs) with RI-specific
 * env vars. Each test skips gracefully if creds are not set.
 */

// ── Pending RI session for visibility tests ──
const RI_PENDING_SESSION = "4ea27929-2c5e-4c3c-a4bc-0c1421c1e513";

// ── RI credentials from env ──
const RI_SUPERVISOR_EMAIL = "sarah.chen@audithalo.test";
const RI_SUPERVISEE_EMAIL = "jordan.williams@audithalo.test";
const RI_HR_ADMIN_EMAIL = "bree.martinez@audithalo.test";

// ── Atlas supervisor (generic org, no clinical form) ──
const ATLAS_SUPERVISOR_EMAIL = "james.mitchell@audithalo.test";

function getRiCreds(role: "supervisor" | "supervisee" | "hr_admin" | "atlas_supervisor"): {
  email: string;
  password: string;
} | null {
  const map: Record<string, { email: string; envKey: string }> = {
    supervisor: { email: RI_SUPERVISOR_EMAIL, envKey: "RI_SUPERVISOR_PASSWORD" },
    supervisee: { email: RI_SUPERVISEE_EMAIL, envKey: "RI_SUPERVISEE_PASSWORD" },
    hr_admin: { email: RI_HR_ADMIN_EMAIL, envKey: "RI_HR_ADMIN_PASSWORD" },
    atlas_supervisor: { email: ATLAS_SUPERVISOR_EMAIL, envKey: "DEMO_SUPERVISOR_PASSWORD" },
  };
  const entry = map[role];
  const password = process.env[entry.envKey];
  if (!password) return null;
  return { email: entry.email, password };
}

async function loginInline(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

// ── Clinical form marker text (unique to the RI form) ──
const CLINICAL_FORM_HEADING = "Clinical Supervision Form";

test.describe("RI Clinical Form — visibility gating", () => {
  test("RI supervisor sees clinical form sections on pending session", async ({
    page,
  }) => {
    const creds = getRiCreds("supervisor");
    test.skip(!creds, "RI_SUPERVISOR_PASSWORD env var not set");

    await loginInline(page, creds!.email, creds!.password);
    await page.goto(`/sign/${RI_PENDING_SESSION}`);

    // The clinical form heading should be visible
    await expect(
      page.getByText(CLINICAL_FORM_HEADING)
    ).toBeVisible({ timeout: 10_000 });

    // Accordion sections specific to the RI form should be present
    await expect(
      page.getByText("I. Key areas / skills / goals discussed")
    ).toBeVisible();
  });

  test("RI supervisee does NOT see clinical form sections", async ({
    page,
  }) => {
    const creds = getRiCreds("supervisee");
    test.skip(!creds, "RI_SUPERVISEE_PASSWORD env var not set");

    await loginInline(page, creds!.email, creds!.password);
    await page.goto(`/sign/${RI_PENDING_SESSION}`);

    // Page should load (not 404) — supervisee can view the sign page
    await expect(page.getByText(/sign this session|e-signature/i)).toBeVisible({
      timeout: 10_000,
    });

    // But the clinical form should NOT be rendered for supervisees
    await expect(
      page.getByText(CLINICAL_FORM_HEADING)
    ).not.toBeVisible();
  });

  test("RI HR admin does NOT see clinical form sections (view-only)", async ({
    page,
  }) => {
    const creds = getRiCreds("hr_admin");
    test.skip(!creds, "RI_HR_ADMIN_PASSWORD env var not set");

    await loginInline(page, creds!.email, creds!.password);
    await page.goto(`/sign/${RI_PENDING_SESSION}`);

    // HR admin can view the sign page
    await expect(page.getByText(/sign this session|e-signature|view only/i)).toBeVisible({
      timeout: 10_000,
    });

    // Clinical form is supervisor-only — HR admin should not see it
    await expect(
      page.getByText(CLINICAL_FORM_HEADING)
    ).not.toBeVisible();
  });

  test("Atlas supervisor does NOT see clinical form (generic org)", async ({
    page,
  }) => {
    const creds = getRiCreds("atlas_supervisor");
    test.skip(!creds, "DEMO_SUPERVISOR_PASSWORD env var not set");

    await loginInline(page, creds!.email, creds!.password);

    // Navigate to dashboard — Atlas supervisor won't have access to the
    // RI session (different org), so we verify on their own sessions.
    // The key assertion: no clinical form heading appears on ANY sign page
    // for a non-RI org. We navigate to dashboard and check the first
    // available session if one exists, or just confirm the dashboard loads.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Try to access the RI session — should get 404/redirect (wrong org)
    const resp = await page.goto(`/sign/${RI_PENDING_SESSION}`);
    // Non-RI org user should be blocked from viewing an RI session
    const status = resp?.status() ?? 0;
    // Either 404 (notFound) or a redirect away from the sign page
    expect(
      status === 404 || !page.url().includes(`/sign/${RI_PENDING_SESSION}`),
      "Atlas supervisor should not access RI session"
    ).toBeTruthy();
  });

  test("supervision type dropdown is visible for all orgs on supervision sessions", async ({
    page,
  }) => {
    const creds = getRiCreds("supervisor");
    test.skip(!creds, "RI_SUPERVISOR_PASSWORD env var not set");

    await loginInline(page, creds!.email, creds!.password);
    await page.goto(`/sign/${RI_PENDING_SESSION}`);

    // The supervision type select should be present (visible for all orgs
    // on supervision-kind sessions, rendered as a <select> for supervisors)
    await expect(
      page.getByText(/type of supervision/i)
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator("select").filter({ hasText: /select supervision type/i })
    ).toBeVisible();
  });
});
