import { test, expect } from "@playwright/test";
import {
  smokeTag,
  findInvitationByEmail,
  deleteInvitationsByEmail,
  closePool,
} from "../helpers/db";

// Full lifecycle: HR Admin submits the Invite Supervisor form on
// /dashboard/team. Verifies via DB that an invitation row was created
// with role=supervisor, then cleans up by deleting the row directly.
//
// Pattern for safe mutation tests:
//   1. Generate a smokeTag → unique @audithalo.test email
//   2. Drive the UI to perform the mutation
//   3. Verify post-state via Node-side DB helper
//   4. Cleanup in `afterAll` so the test never leaves orphans
//
// The fake email at @audithalo.test means Resend WILL attempt + bounce.
// That's accepted noise; not catastrophic. A future E2E_NO_EMAILS flag
// could short-circuit the Resend send path.

const ORG_ID = process.env.E2E_ORG_ID;

test.describe("HR Admin invites a Supervisor", () => {
  let testEmail: string;

  test.beforeAll(() => {
    const tag = smokeTag();
    testEmail = `e2e+supinvite-${tag}@audithalo.test`;
  });

  test.afterAll(async () => {
    if (testEmail) {
      await deleteInvitationsByEmail(testEmail);
    }
    await closePool();
  });

  test("creates a pending invitation row with role=supervisor", async ({
    page,
  }) => {
    test.skip(!ORG_ID, "E2E_ORG_ID not set");

    await page.goto("/dashboard/team");
    await expect(page).toHaveURL(/\/dashboard\/team/);

    // InviteSupervisorForm's email input is keyed with id="sup-email"
    // (vs the HR Admin form's "hr-email") — most reliable selector.
    const emailInput = page.locator("#sup-email");
    await emailInput.fill(testEmail);
    const form = emailInput.locator("xpath=ancestor::form");
    await form.getByRole("button", { name: /send invitation/i }).click();

    // Form replaces itself with a success message on completion.
    await expect(
      page.getByText(/supervisor invitation sent/i)
    ).toBeVisible({ timeout: 10_000 });

    // DB verifier — invitation row created with the right role.
    const inv = await findInvitationByEmail(ORG_ID!, testEmail);
    expect(inv).not.toBeNull();
    expect(inv?.role).toBe("supervisor");
  });
});
