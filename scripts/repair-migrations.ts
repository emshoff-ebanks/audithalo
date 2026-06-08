/**
 * Repair drizzle migration state.
 *
 * The /drizzle/meta/_journal.json file in this repo was only kept up to date
 * through migration 0003 — migrations 0004+ were hand-written SQL applied via
 * some out-of-band path, and drizzle-kit was never re-run. As a result,
 * `npm run db:migrate` is a silent no-op for new SQL files: it reads the
 * journal, sees only 0000-0003 to consider, finds them already applied in
 * drizzle.__drizzle_migrations, and exits with "Done."
 *
 * This script applies a hand-picked list of SQL files directly, then records
 * each in drizzle.__drizzle_migrations so a future re-run won't duplicate
 * them. Idempotent — checks information_schema before applying.
 *
 * Usage: npx tsx scripts/repair-migrations.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const DRIZZLE_DIR = join(process.cwd(), "drizzle");

// Migrations to repair. Each is a (file, sentinel-check) pair: the sentinel
// is a SQL fragment that returns >0 rows when the migration is already
// applied. If the sentinel reports applied, the SQL is skipped.
const REPAIR_TARGETS: Array<{
  file: string;
  sentinel: string;
}> = [
  {
    file: "0018_invitation_pending_assignment.sql",
    sentinel: `SELECT 1 FROM information_schema.columns
               WHERE table_name='invitations' AND column_name='pending_rule_id'`,
  },
  {
    file: "0019_organizations_seat_count.sql",
    sentinel: `SELECT 1 FROM information_schema.columns
               WHERE table_name='organizations' AND column_name='seat_count'`,
  },
  {
    file: "0020_users_deleted_at.sql",
    sentinel: `SELECT 1 FROM information_schema.columns
               WHERE table_name='users' AND column_name='deleted_at'`,
  },
  {
    file: "0021_rule_source_snapshots.sql",
    sentinel: `SELECT 1 FROM information_schema.tables
               WHERE table_name='rule_source_snapshots'`,
  },
  {
    file: "0022_users_founding_supervisor.sql",
    sentinel: `SELECT 1 FROM information_schema.columns
               WHERE table_name='users' AND column_name='is_founding_supervisor'`,
  },
  {
    file: "0023_enterprise_rbac_foundation.sql",
    sentinel: `SELECT 1 FROM information_schema.tables
               WHERE table_name='supervisor_assignments'`,
  },
];

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const host = new URL(url).hostname;
  console.log(`[repair] target: ${host}`);

  const pool = new Pool({ connectionString: url });

  for (const { file, sentinel } of REPAIR_TARGETS) {
    const sentinelRes = await pool.query(sentinel);
    if ((sentinelRes.rowCount ?? 0) > 0) {
      console.log(`[repair] skip ${file} — sentinel reports already applied`);
      continue;
    }

    const sql = readFileSync(join(DRIZZLE_DIR, file), "utf8");
    const hash = sha256(sql);
    console.log(`[repair] applying ${file} ...`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const statements = sql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await client.query(stmt);
      }
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
         VALUES ($1, $2)`,
        [hash, Date.now()]
      );
      await client.query("COMMIT");
      console.log(`[repair] ok ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Failed applying ${file}: ${err}`);
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log("[repair] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
