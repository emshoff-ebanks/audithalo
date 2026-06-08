import { test, expect } from "@playwright/test";
import {
  smokeTag,
  seedInvitation,
  findInvitationByEmail,
  deleteInvitationsByEmail,
  closePool,
} from "../helpers/db";

// Pre-seeds an invitation via direct DB insert, then navigates the UI
// to cancel it. Verifies the invitation row is removed.
//
// Confirms the cancel-flow happy path without depending on a prior
// invite-mutation test having run (decoupled, can run independently).

const ORG_ID = process.env.E2E_ORG_ID;

test.describe("HR Admin cancels an existing supervisor invitation", () => {
  let testEmail: string;

  test.beforeAll(async () => {
    test.skip(!ORG_ID, "E2E_ORG_ID not set");
    const tag = smokeTag();
    testEmail = `e2e+cancel-${tag}@audithalo.test`;
    await seedInvitation({
      orgId: ORG_ID!,
      email: testEmail,
      role: "supervisor",
      name: `E2E Cancel Target ${tag}`,
    });
  });

  test.afterAll(async () => {
    // Belt + suspenders — if the UI cancel didn't run (test failure),
    // make sure the row doesn't linger.
    if (testEmail) {
      await deleteInvitationsByEmail(testEmail);
    }
    await closePool();
  });

  test("UI cancel removes the invitation row from the DB", async ({ page }) => {
    test.skip(!ORG_ID, "E2E_ORG_ID not set");

    // Auto-accept the confirm() dialog the cancel form throws.
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/dashboard/team");
    await expect(page).toHaveURL(/\/dashboard\/team/);

    // The pending invitation row is rendered by PendingInvitesList under
    // the Supervisors section. Find the row by email text, then locate
    // its Cancel button (within the same li).
    const row = page.locator("li").filter({ hasText: testEmail });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: /cancel/i }).click();

    // Wait for the row to disappear or the page to revalidate.
    await page.waitForTimeout(2000);

    // DB verifier: invitation row should be gone.
    const inv = await findInvitationByEmail(ORG_ID!, testEmail);
    expect(inv).toBeNull();
  });
});
