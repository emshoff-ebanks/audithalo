/**
 * Reset passwords on the three demo / E2E test accounts in the Damon Test
 * Org. Designed for the 2026-06-16 demo-readiness Playwright run.
 *
 * SAFETY:
 *   - Targets exactly three known emails (all on the @audithalo.test domain,
 *     never used by real customers).
 *   - Defensive 2FA clear in case anyone flips it on between now and demo.
 *   - Bumps sessions_valid_from so any lingering JWTs on these accounts are
 *     invalidated (matches the behavior of the in-app password-change flow).
 *   - Dry-run by default. Prints the exact SQL that WOULD run. Pass --apply
 *     to actually write to the prod DB.
 *
 * USAGE:
 *   # 1. See what would happen — no writes:
 *   npx tsx scripts/reset-demo-passwords.ts
 *
 *   # 2. Actually run it:
 *   npx tsx scripts/reset-demo-passwords.ts --apply
 *
 * OUTPUT (on --apply):
 *   Prints an env block ready to paste into .env.local, e.g.
 *     E2E_HR_ADMIN_EMAIL=damon-test-hr@audithalo.test
 *     E2E_HR_ADMIN_PASSWORD=<freshly generated>
 *     ...
 *
 * AFTER THE DEMO:
 *   These passwords are scratch — rotate them again or delete the test
 *   accounts. The bcrypt cost factor matches src/app/actions/auth.ts (12),
 *   so the values are throwaway-strong but not meant to persist.
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

type Target = {
  email: string;
  envEmailKey: string;
  envPasswordKey: string;
};

const TARGETS: Target[] = [
  {
    email: "damon-test-hr@audithalo.test",
    envEmailKey: "E2E_HR_ADMIN_EMAIL",
    envPasswordKey: "E2E_HR_ADMIN_PASSWORD",
  },
  {
    email: "damon-test-supervisor@audithalo.test",
    envEmailKey: "E2E_SUPERVISOR_EMAIL",
    envPasswordKey: "E2E_SUPERVISOR_PASSWORD",
  },
  {
    email: "damon-test-supervisee@audithalo.test",
    envEmailKey: "E2E_SUPERVISEE_EMAIL",
    envPasswordKey: "E2E_SUPERVISEE_PASSWORD",
  },
];

const BCRYPT_COST = 12; // mirrors src/app/actions/auth.ts:49

function generatePassword(): string {
  // 18 random bytes → 24-char URL-safe base64. Strong, no shell-escape pain.
  return randomBytes(18).toString("base64url");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");

  const sql = neon(url);

  // Pre-flight: confirm all three accounts exist and aren't soft-deleted.
  const existing = await sql`
    select email, deleted_at, totp_enabled_at
    from users
    where email = any(${TARGETS.map((t) => t.email)}::text[])
    order by email
  `;
  if (existing.length !== TARGETS.length) {
    const found = new Set(existing.map((r) => r.email));
    const missing = TARGETS.filter((t) => !found.has(t.email)).map((t) => t.email);
    console.error("ABORT: missing expected accounts:", missing);
    process.exit(2);
  }
  const softDeleted = existing.filter((r) => r.deleted_at !== null);
  if (softDeleted.length > 0) {
    console.error(
      "ABORT: at least one target account is soft-deleted:",
      softDeleted.map((r) => r.email)
    );
    process.exit(3);
  }

  // Generate passwords + hashes now so the dry-run output is realistic.
  const plan = await Promise.all(
    TARGETS.map(async (t) => {
      const password = generatePassword();
      const hash = await bcrypt.hash(password, BCRYPT_COST);
      return { ...t, password, hash };
    })
  );

  // Echo the SQL that will / would run.
  console.log("──── PLAN ────");
  console.log(`Mode: ${apply ? "APPLY (writes to prod)" : "DRY-RUN (no writes)"}`);
  console.log(`Target host: ${new URL(url).host}`);
  console.log("");
  console.log("Per account, the following UPDATE will run:");
  console.log(`  UPDATE users`);
  console.log(`     SET password_hash      = <fresh bcrypt(cost=${BCRYPT_COST})>,`);
  console.log(`         totp_enabled_at    = NULL,`);
  console.log(`         totp_secret        = NULL,`);
  console.log(`         totp_backup_codes  = NULL,`);
  console.log(`         sessions_valid_from = NOW()`);
  console.log(`   WHERE email = $1 AND deleted_at IS NULL`);
  console.log("");
  console.log("Accounts targeted:");
  for (const p of plan) console.log(`  - ${p.email}`);
  console.log("");

  if (!apply) {
    console.log("DRY-RUN. Re-run with --apply to actually write.");
    process.exit(0);
  }

  // Apply, one account at a time, with row-count verification.
  for (const p of plan) {
    const r = await sql`
      update users
         set password_hash       = ${p.hash},
             totp_enabled_at     = null,
             totp_secret         = null,
             totp_backup_codes   = null,
             sessions_valid_from = now()
       where email = ${p.email}
         and deleted_at is null
      returning email
    `;
    if (r.length !== 1) {
      console.error(`ABORT mid-flight: updated ${r.length} rows for ${p.email}`);
      process.exit(4);
    }
  }

  // Print the env block. STDOUT only — never log into a file.
  console.log("──── DONE — PASTE INTO .env.local ────");
  console.log("");
  for (const p of plan) {
    console.log(`${p.envEmailKey}=${p.email}`);
    console.log(`${p.envPasswordKey}=${p.password}`);
  }
  console.log("");
  console.log("These are SCRATCH credentials. Rotate or delete after the demo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
