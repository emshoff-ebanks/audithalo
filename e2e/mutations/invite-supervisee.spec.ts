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

    // The invite form lives in a modal opened next to the roster search.
    await page.getByRole("button", { name: /^invite supervisee$/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The roster invite-form has id="invite-email"
    const emailInput = dialog.locator("#invite-email");
    await emailInput.fill(testEmail);
    const form = emailInput.locator("xpath=ancestor::form");
    await form.locator("button[type='submit']").click();

    // The modal closes itself on success; verify the row via DB.
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect
      .poll(async () => (await findInvitationByEmail(ORG_ID!, testEmail))?.role ?? null, { timeout: 10_000 })
      .toBe("supervisee");
  });
});
