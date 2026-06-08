/**
 * Seed 4 E2E test users + 1 Enterprise org + supervisor assignment.
 *
 * Idempotent — re-running deletes the prior E2E org and rebuilds it from
 * scratch with fresh credentials.
 *
 * Run: npx tsx scripts/seed-e2e-users.ts
 *
 * Output: prints the generated credentials so they can be set as Vercel
 * env vars. Save them — passwords are NOT recoverable from the DB.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const ORG_NAME = "E2E Test Org";
const ORG_EMAIL_DOMAIN = "audithalo.test";

type RoleSpec = {
  role: "hr_admin" | "supervisor" | "supervisee" | "executive";
  envPrefix: string;
  emailLocal: string;
  fullName: string;
};

const ROLES: RoleSpec[] = [
  { role: "hr_admin",  envPrefix: "E2E_HR_ADMIN",  emailLocal: "e2e-hr-admin",  fullName: "E2E HR Admin"  },
  { role: "supervisor", envPrefix: "E2E_SUPERVISOR", emailLocal: "e2e-supervisor", fullName: "E2E Supervisor" },
  { role: "supervisee", envPrefix: "E2E_SUPERVISEE", emailLocal: "e2e-supervisee", fullName: "E2E Supervisee" },
  { role: "executive",  envPrefix: "E2E_EXECUTIVE",  emailLocal: "e2e-executive",  fullName: "E2E Executive"  },
];

function genPassword(): string {
  // 16 chars from URL-safe alphabet — strong enough for test creds, easy to copy.
  return randomBytes(12).toString("base64url").slice(0, 16);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  console.log(`target: ${new URL(url).hostname}\n`);

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Clean slate — drop prior E2E org + all related users.
    //    Cascade handles memberships + supervisor_assignments.
    const prior = await client.query(
      `SELECT id FROM organizations WHERE name = $1`,
      [ORG_NAME]
    );
    if (prior.rowCount && prior.rowCount > 0) {
      console.log(`[seed] removing prior E2E org (${prior.rowCount} found)`);
      await client.query(`DELETE FROM organizations WHERE name = $1`, [ORG_NAME]);
      await client.query(
        `DELETE FROM users WHERE email LIKE $1`,
        [`%@${ORG_EMAIL_DOMAIN}`]
      );
    }

    // 2. Create users — passwords generated, bcrypt-hashed, marked verified.
    const userIds: Record<string, string> = {};
    const credentials: Array<{ role: string; email: string; password: string; envPrefix: string }> = [];

    for (const r of ROLES) {
      const email = `${r.emailLocal}@${ORG_EMAIL_DOMAIN}`;
      const password = genPassword();
      const passwordHash = await bcrypt.hash(password, 10);

      const ins = await client.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified_at)
         VALUES ($1, $2, $3, $4::user_role, NOW())
         RETURNING id`,
        [email, passwordHash, r.fullName, r.role]
      );
      const userId = ins.rows[0].id;
      userIds[r.role] = userId;
      credentials.push({ role: r.role, email, password, envPrefix: r.envPrefix });
      console.log(`[seed] user created: ${r.role.padEnd(11)} ${email}`);
    }

    // 3. Create org with HR Admin as owner; set tier to enterprise.
    const orgIns = await client.query(
      `INSERT INTO organizations
         (name, created_by_id, subscription_tier, subscription_status)
       VALUES ($1, $2, 'enterprise', 'active')
       RETURNING id`,
      [ORG_NAME, userIds.hr_admin]
    );
    const orgId = orgIns.rows[0].id;
    console.log(`[seed] org created: ${ORG_NAME} (${orgId})`);

    // 4. Org settings row (the post-migration backfill normally handles this
    //    on the live system; for a new org we insert explicitly).
    await client.query(
      `INSERT INTO org_settings (org_id) VALUES ($1)
       ON CONFLICT (org_id) DO NOTHING`,
      [orgId]
    );

    // 5. Memberships — one per role.
    for (const r of ROLES) {
      await client.query(
        `INSERT INTO org_memberships (org_id, user_id, role)
         VALUES ($1, $2, $3::user_role)`,
        [orgId, userIds[r.role], r.role]
      );
    }
    console.log(`[seed] 4 memberships created`);

    // 6. Supervisor assignment: supervisor → supervisee (primary).
    await client.query(
      `INSERT INTO supervisor_assignments
         (org_id, supervisor_id, supervisee_id, is_primary)
       VALUES ($1, $2, $3, true)`,
      [orgId, userIds.supervisor, userIds.supervisee]
    );
    console.log(`[seed] supervisor_assignment created (supervisor → supervisee)`);

    await client.query("COMMIT");

    // 7. Print credentials block ready to paste into env vars.
    console.log("\n──────────────────────────────────────────────────────────");
    console.log("CREDENTIALS — save these now, passwords cannot be recovered");
    console.log("──────────────────────────────────────────────────────────");
    console.log(`E2E_ORG_ID=${orgId}`);
    for (const c of credentials) {
      console.log(`${c.envPrefix}_EMAIL=${c.email}`);
      console.log(`${c.envPrefix}_PASSWORD=${c.password}`);
    }
    console.log("──────────────────────────────────────────────────────────\n");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
