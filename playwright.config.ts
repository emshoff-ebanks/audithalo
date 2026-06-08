import { defineConfig, devices } from "@playwright/test";

// E2E_BASE_URL lets you point the suite at any environment:
//   - default: production app (https://app.audithalo.com)
//   - local:   http://app.localhost:3000 (requires `npm run dev` running)
//   - preview: a Vercel preview URL — though host-based routing on
//     *.vercel.app currently only serves the marketing namespace, so
//     app tests need either prod or local app.localhost.
const baseURL = process.env.E2E_BASE_URL ?? "https://app.audithalo.com";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
