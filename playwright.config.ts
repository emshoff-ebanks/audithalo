import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Load .env.local so locally-configured E2E creds are available without
// needing the operator to remember `dotenv -e .env.local --` prefixes.
// CI sets these via repo secrets and ignores the missing file.
loadEnv({ path: ".env.local" });

// E2E_BASE_URL lets you point the suite at any environment:
//   - default: production app (https://app.audithalo.com)
//   - local:   http://app.localhost:3000 (requires `npm run dev` running)
//   - preview: a Vercel preview URL — though host-based routing on
//     *.vercel.app currently only serves the marketing namespace, so
//     app tests need either prod or local app.localhost.
const baseURL = process.env.E2E_BASE_URL ?? "https://app.audithalo.com";

// The auth-setup + RBAC projects only activate when test-user credentials
// are present. This lets the unauthed healthcheck spec run in any env
// (CI without secrets, fresh contributors, etc.) without failing on
// missing creds. See docs/strategy/07-e2e-testing.md.
const hasE2ECreds = !!process.env.E2E_HR_ADMIN_EMAIL;

// Demo-readiness specs (2026-06-15+). Use a separate set of creds for
// the damon-test-* accounts in the Damon Test Org so they don't collide
// with the existing seeded e2e-* accounts. See
// docs/strategy/11-demo-readiness-test-plan.md.
const hasDemoCreds = !!process.env.DEMO_HR_ADMIN_EMAIL;

// RI Clinical Form specs. Use a separate set of creds for the RI test org
// (sarah.chen / jordan.williams / bree.martinez). Inline login, no shared
// storage state.
const hasRiCreds = !!process.env.RI_SUPERVISOR_PASSWORD;

const STORAGE_HR_ADMIN = "playwright/.auth/hr_admin.json";

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
    // Always run: unauthed healthcheck. Safe against any env.
    {
      name: "healthcheck",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /healthcheck\.spec\.ts/,
    },
    // Marketing tests are unauthed and safe in any env.
    {
      name: "marketing",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /marketing\/.*\.spec\.ts/,
    },
    // Below projects only activate when E2E_* creds are configured.
    ...(hasE2ECreds
      ? [
          {
            name: "auth-setup",
            testMatch: /auth\.setup\.ts/,
          },
          {
            name: "rbac",
            use: {
              ...devices["Desktop Chrome"],
              storageState: STORAGE_HR_ADMIN,
            },
            testMatch: /rbac\/.*\.spec\.ts/,
            dependencies: ["auth-setup"],
          },
          // Mutation tests share auth setup; default to HR Admin storage.
          // Each spec is responsible for cleanup (smokeTag prefix + helpers).
          {
            name: "mutations",
            use: {
              ...devices["Desktop Chrome"],
              storageState: STORAGE_HR_ADMIN,
            },
            testMatch: /mutations\/.*\.spec\.ts/,
            dependencies: ["auth-setup"],
          },
        ]
      : []),
    // Demo-readiness projects. These log in inline using DEMO_* env vars
    // (the damon-test-* accounts whose passwords are rotated by
    // scripts/reset-demo-passwords.ts) and don't share storage state
    // with the e2e-* projects above.
    ...(hasDemoCreds
      ? [
          {
            name: "demo-smoke",
            use: { ...devices["Desktop Chrome"] },
            testMatch: /demo-smoke\/.*\.spec\.ts/,
          },
          {
            name: "hostile",
            use: { ...devices["Desktop Chrome"] },
            testMatch: /hostile\/(?!mobile).*\.spec\.ts/,
          },
          {
            name: "hostile-mobile",
            // Device viewport configured inside the spec via test.use().
            testMatch: /hostile\/mobile\.spec\.ts/,
          },
        ]
      : []),
    // RI Clinical Form specs. Inline login with RI_* env vars.
    ...(hasRiCreds
      ? [
          {
            name: "clinical-form",
            use: { ...devices["Desktop Chrome"] },
            testMatch: /clinical-form\/.*\.spec\.ts/,
          },
        ]
      : []),
  ],
});
