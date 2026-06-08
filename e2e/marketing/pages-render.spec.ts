import { test, expect } from "@playwright/test";

// Marketing site is on audithalo.com (separate host from app.audithalo.com).
// Tests use absolute URLs to bypass the configured app baseURL.
// All tests are read-only: no forms submitted, no DB writes.

const MARKETING_BASE = "https://audithalo.com";

const PAGES: Array<{ path: string; expectedTitle: RegExp }> = [
  { path: "/", expectedTitle: /AuditHalo/i },
  { path: "/pricing", expectedTitle: /pricing|AuditHalo/i },
  { path: "/features", expectedTitle: /features|AuditHalo/i },
  { path: "/for-supervisors", expectedTitle: /supervisor|AuditHalo/i },
  { path: "/for-group-practices", expectedTitle: /practice|AuditHalo/i },
  { path: "/security", expectedTitle: /security|AuditHalo/i },
  { path: "/contact", expectedTitle: /contact|AuditHalo/i },
  { path: "/founding", expectedTitle: /founding|AuditHalo/i },
  { path: "/states", expectedTitle: /states|AuditHalo/i },
  { path: "/evidence-packages", expectedTitle: /evidence|AuditHalo/i },
];

for (const { path, expectedTitle } of PAGES) {
  test(`marketing ${path} renders`, async ({ page }) => {
    const resp = await page.goto(`${MARKETING_BASE}${path}`);
    expect(resp?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(expectedTitle);
    // Every marketing page should have at least one H1 visible.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });
}
