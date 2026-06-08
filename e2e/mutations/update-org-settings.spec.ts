import { test, expect } from "@playwright/test";
import {
  getOrgSettings,
  setOrgRetentionYears,
  closePool,
} from "../helpers/db";

// HR Admin updates the audit-log retention setting via /dashboard/settings.
// DB verifier confirms the value persisted; afterAll restores the
// original value so the org doesn't drift across test runs.

const ORG_ID = process.env.E2E_ORG_ID;

test.describe("HR Admin updates audit log retention", () => {
  let originalValue: number;
  const targetValue = 9; // arbitrary, just different from the default 7

  test.beforeAll(async () => {
    test.skip(!ORG_ID, "E2E_ORG_ID not set");
    const settings = await getOrgSettings(ORG_ID!);
    originalValue = settings?.auditLogRetentionYears ?? 7;
  });

  test.afterAll(async () => {
    if (ORG_ID && originalValue !== undefined) {
      await setOrgRetentionYears(ORG_ID, originalValue);
    }
    await closePool();
  });

  test("submitting the form updates audit_log_retention_years in DB", async ({
    page,
  }) => {
    test.skip(!ORG_ID, "E2E_ORG_ID not set");

    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/dashboard\/settings/);

    const input = page.locator("#retention-years");
    await input.fill(String(targetValue));
    await page.getByRole("button", { name: /save retention/i }).click();

    // Wait for the "Saved" success message.
    await expect(page.getByText(/^Saved\.$/)).toBeVisible({ timeout: 10_000 });

    // DB verifier confirms persistence.
    const settings = await getOrgSettings(ORG_ID!);
    expect(settings?.auditLogRetentionYears).toBe(targetValue);
  });
});
