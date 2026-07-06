import { test, expect, Page } from "@playwright/test";

/**
 * RI Clinical Supervision Form — PDF template branching.
 *
 * Verifies that the evidence PDF download for an RI org uses the
 * "ri-clinical-supervision-" filename prefix and returns application/pdf.
 * Uses a pre-sealed session's evidence package ID.
 *
 * The evidence API route (/api/evidence/[id]) checks the org's
 * pdfTemplateKey and renders the appropriate PDF component
 * (RiClinicalSupervisionPdf vs EvidencePdf).
 */

const EVIDENCE_PACKAGE_ID = "3ddc4a0b-7c91-4a19-b493-8ef3b99bc548";
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

test.describe("RI Evidence PDF — template branching", () => {
  test.skip(
    () => !getRiSupervisorPassword(),
    "RI_SUPERVISOR_PASSWORD env var not set"
  );

  test("RI evidence PDF filename starts with ri-clinical-supervision-", async ({
    page,
  }) => {
    await loginInline(page, RI_SUPERVISOR_EMAIL, getRiSupervisorPassword()!);

    // Use the page's request context (authenticated via cookies) to fetch
    // the evidence PDF API endpoint.
    const response = await page.request.get(
      `/api/evidence/${EVIDENCE_PACKAGE_ID}`
    );

    expect(response.status()).toBe(200);

    const contentDisposition = response.headers()["content-disposition"] ?? "";
    expect(
      contentDisposition,
      "Content-Disposition should contain ri-clinical-supervision- prefix"
    ).toMatch(/ri-clinical-supervision-/);
  });

  test("RI evidence PDF response is application/pdf", async ({ page }) => {
    await loginInline(page, RI_SUPERVISOR_EMAIL, getRiSupervisorPassword()!);

    const response = await page.request.get(
      `/api/evidence/${EVIDENCE_PACKAGE_ID}`
    );

    expect(response.status()).toBe(200);

    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/pdf");
  });
});
