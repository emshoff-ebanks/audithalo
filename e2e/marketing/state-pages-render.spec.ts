import { test, expect } from "@playwright/test";

// One landing page per supported state. These power the SEO long-tail
// strategy — a 500 on any of them is a real revenue hit.

const MARKETING_BASE = "https://audithalo.com";

const STATES: Array<{ slug: string; expectedKeyword: RegExp }> = [
  { slug: "nc-lcmhca", expectedKeyword: /NC|North Carolina|LCMHCA/i },
  { slug: "ca-apcc", expectedKeyword: /CA|California|APCC/i },
  { slug: "tx-lpc-associate", expectedKeyword: /TX|Texas|LPC/i },
  { slug: "fl-rmhci", expectedKeyword: /FL|Florida|RMHCI/i },
  { slug: "ny-lmhc-lp", expectedKeyword: /NY|New York|LMHC/i },
];

for (const { slug, expectedKeyword } of STATES) {
  test(`/states/${slug} renders state-specific content`, async ({ page }) => {
    const resp = await page.goto(`${MARKETING_BASE}/states/${slug}`);
    expect(resp?.status()).toBeLessThan(400);
    // State name or license code should appear somewhere on the page.
    await expect(page.locator("body")).toContainText(expectedKeyword);
  });
}
