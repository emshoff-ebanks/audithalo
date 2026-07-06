import { test, expect, Page } from "@playwright/test";

/**
 * RI Clinical Supervision Form — auto-save persistence.
 *
 * Verifies that form data survives a page reload. The clinical form uses
 * a debounced server action (saveClinicalFormDataAction) that patches the
 * session_events.clinical_form_data JSONB column. After each interaction
 * we wait for the "Saved" indicator, reload, and assert the value stuck.
 *
 * All tests run as the RI supervisor on the pending session.
 */

const RI_PENDING_SESSION = "4ea27929-2c5e-4c3c-a4bc-0c1421c1e513";
const RI_SUPERVISOR_EMAIL = "sarah.chen@audithalo.test";

function getRiSupervisorPassword(): string | null {
  return process.env.RI_SUPERVISOR_PASSWORD ?? null;
}

async function loginInline(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("RI Clinical Form — auto-save persistence", () => {
  test.skip(
    () => !getRiSupervisorPassword(),
    "RI_SUPERVISOR_PASSWORD env var not set"
  );

  test.beforeEach(async ({ page }) => {
    await loginInline(page, RI_SUPERVISOR_EMAIL, getRiSupervisorPassword()!);
    await page.goto(`/sign/${RI_PENDING_SESSION}`);
    // Wait for clinical form to render
    await expect(page.getByText("Clinical Supervision Form")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("competency checkbox persists across reload", async ({ page }) => {
    // Expand the competencies section (it's defaultOpen, but verify)
    await expect(
      page.getByText("I. Key areas / skills / goals discussed")
    ).toBeVisible();

    // Find and check a core skill checkbox (e.g., the first one)
    const firstCoreSkill = page
      .locator('input[type="checkbox"]')
      .first();
    const wasChecked = await firstCoreSkill.isChecked();

    // Toggle the checkbox
    if (wasChecked) {
      await firstCoreSkill.uncheck();
    } else {
      await firstCoreSkill.check();
    }

    // Wait for auto-save indicator
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5_000 });

    // Reload the page
    await page.reload();
    await expect(page.getByText("Clinical Supervision Form")).toBeVisible({
      timeout: 10_000,
    });

    // Verify the checkbox state persisted
    const firstCoreSkillAfter = page
      .locator('input[type="checkbox"]')
      .first();
    const isCheckedAfter = await firstCoreSkillAfter.isChecked();
    expect(isCheckedAfter).toBe(!wasChecked);
  });

  test("textarea value persists across reload", async ({ page }) => {
    // The "Additional context" section is defaultOpen — type into its textarea
    const additionalContextButton = page.getByText("VI. Additional context");
    await expect(additionalContextButton).toBeVisible();

    // Ensure the section is expanded by clicking if needed
    const textarea = page.locator(
      'textarea[placeholder="Feedback, affirmations, or additional context..."]'
    );
    if (!(await textarea.isVisible())) {
      await additionalContextButton.click();
    }
    await expect(textarea).toBeVisible();

    // Generate a unique test value to avoid collision with prior test runs
    const testValue = `E2E persistence test ${Date.now()}`;

    // Clear and fill
    await textarea.fill(testValue);
    // Blur to trigger the onBlur save
    await textarea.blur();

    // Wait for auto-save
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5_000 });

    // Reload
    await page.reload();
    await expect(page.getByText("Clinical Supervision Form")).toBeVisible({
      timeout: 10_000,
    });

    // Re-expand the section if collapsed after reload
    const textareaAfter = page.locator(
      'textarea[placeholder="Feedback, affirmations, or additional context..."]'
    );
    if (!(await textareaAfter.isVisible())) {
      await page.getByText("VI. Additional context").click();
    }
    await expect(textareaAfter).toBeVisible();

    // Assert the value persisted
    await expect(textareaAfter).toHaveValue(testValue);
  });

  test("supervision type selection persists across reload", async ({ page }) => {
    // The supervision type select is above the clinical form
    const typeSelect = page.locator("select").filter({
      hasText: /select supervision type|individual|triadic|group/i,
    });
    await expect(typeSelect).toBeVisible({ timeout: 10_000 });

    // Select "individual" (or toggle to a different value)
    const currentValue = await typeSelect.inputValue();
    const newValue = currentValue === "individual" ? "triadic" : "individual";
    await typeSelect.selectOption(newValue);

    // Wait for the server action to complete (useTransition — no explicit
    // "Saved" indicator on the supervision type select, but we can wait
    // for the select to not be disabled)
    await page.waitForTimeout(1500);

    // Reload
    await page.reload();

    // Re-locate and verify
    const typeSelectAfter = page.locator("select").filter({
      hasText: /select supervision type|individual|triadic|group/i,
    });
    await expect(typeSelectAfter).toBeVisible({ timeout: 10_000 });
    await expect(typeSelectAfter).toHaveValue(newValue);
  });
});
