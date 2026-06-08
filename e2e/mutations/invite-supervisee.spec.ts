import { test, expect } from "@playwright/test";
import {
  smokeTag,
  findInvitationByEmail,
  deleteInvitationsByEmail,
  closePool,
} from "../helpers/db";

// Supervisor invites a supervisee from /dashboard/roster. Verifies the
// invitation row is created with role=supervisee, then cleans up.
//
// Doesn't fill the optional ruleId Select — supervisees can be invited
// without a pre-assigned rule (supervisor sets it after acceptance).
//
// HR Admin can ALSO invite via the same action after the canSupervise →
// isManagerRole fix (see commit message). This spec stays on Supervisor
// storage to keep the auto-assign-to-self path tested end-to-end.

const ORG_ID = process.env.E2E_ORG_ID;

test.use({ storageState: "playwright/.auth/supervisor.json" });

test.describe("Supervisor invites a Supervisee", () => {
  let testEmail: string;

  test.beforeAll(() => {
    const tag = smokeTag();
    testEmail = `e2e+sveinvite-${tag}@audithalo.test`;
  });

  test.afterAll(async () => {
    if (testEmail) {
      await deleteInvitationsByEmail(testEmail);
    }
    await closePool();
  });

  test("creates a pending invitation row with role=supervisee", async ({
    page,
  }) => {
    test.skip(!ORG_ID, "E2E_ORG_ID not set");

    await page.goto("/dashboard/roster");
    await expect(page).toHaveURL(/\/dashboard\/roster/);

    // The roster invite-form has id="invite-email"
    const emailInput = page.locator("#invite-email");
    await emailInput.fill(testEmail);
    const form = emailInput.locator("xpath=ancestor::form");
    // Button label uses "Send invite" or similar
    await form.locator("button[type='submit']").click();

    // Either a success toast/state appears, or the form clears + a new
    // pending row shows in the table. Verify via DB rather than UI text
    // (UI feedback may vary).
    await page.waitForTimeout(1500);
    const inv = await findInvitationByEmail(ORG_ID!, testEmail);
    expect(inv).not.toBeNull();
    expect(inv?.role).toBe("supervisee");
  });
});
