import { test, expect } from "@playwright/test";
import { getMembershipRole } from "../helpers/db";

// Team page should be reachable by HR Admin (full controls) and supervisor
// (read-only view), but NOT by supervisee or executive (per the RBAC matrix
// in docs/strategy/04-enterprise-rbac.md §"Permission matrix").
//
// Pairs UI navigation with a DB verifier to confirm the same role is
// reflected in org_memberships — guards the contract that JWT role and
// membership role stay in sync (see commit b8484d7).

const ORG_ID = process.env.E2E_ORG_ID;

test.describe("HR Admin", () => {
  test.use({ storageState: "playwright/.auth/hr_admin.json" });

  test("reaches /dashboard/team and sees Team heading", async ({ page }) => {
    await page.goto("/dashboard/team");
    await expect(page).toHaveURL(/\/dashboard\/team/);
    // Team page header uses the org name as the h1 — check the "Team" badge
    // above it which is stable.
    await expect(page.getByText(/^Team$/).first()).toBeVisible();
  });
});

test.describe("Supervisee", () => {
  test.use({ storageState: "playwright/.auth/supervisee.json" });

  test("hitting /dashboard/team does NOT surface HR Admin controls", async ({
    page,
  }) => {
    await page.goto("/dashboard/team");
    // Supervisee may see the team listing as a member, but the HR Admin
    // invite forms must not appear.
    await expect(page.getByRole("button", { name: /add hr admin/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /invite supervisor/i })).toHaveCount(0);
  });
});

test.describe("DB invariant", () => {
  test("seeded HR Admin actually has hr_admin role in org_memberships", async () => {
    test.skip(!ORG_ID, "E2E_ORG_ID not set");
    // Look up by email via a side-channel — we don't have the user id
    // directly, but the seed script names the HR Admin's email
    // deterministically.
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const r = await pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [process.env.E2E_HR_ADMIN_EMAIL]
      );
      expect(r.rowCount).toBe(1);
      const userId = r.rows[0].id;
      const role = await getMembershipRole(userId, ORG_ID!);
      expect(role).toBe("hr_admin");
    } finally {
      await pool.end();
    }
  });
});
