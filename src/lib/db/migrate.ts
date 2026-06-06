/**
 * Standard drizzle migration runner.
 *
 * IMPORTANT: drizzle/meta/_journal.json was historically only kept current
 * through migration 0003. Subsequent migrations (0004+) were applied via
 * out-of-band paths, leaving the journal out of sync with both the SQL files
 * on disk and the __drizzle_migrations rows in the DB. As a result, this
 * script may report "Done." while doing nothing for newly added SQL files.
 *
 * Workflow for adding a new migration:
 *   1. Add the SQL file under /drizzle/NNNN_*.sql as usual.
 *   2. Add an entry under REPAIR_TARGETS in scripts/repair-migrations.ts
 *      with a sentinel SQL fragment that returns >0 rows once applied.
 *   3. Run `npx tsx scripts/repair-migrations.ts` to apply it.
 *
 * The repair script is idempotent — it checks the sentinel before running
 * the SQL — so it's safe to commit and re-run from any environment.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log("Applying migrations from ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Done.");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
