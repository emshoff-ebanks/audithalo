import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(
    "UPDATE organizations SET paycor_config = NULL WHERE name = 'Recovery Innovations Test'",
  );

  const res = await pool.query(
    "SELECT id, name, paycor_config FROM organizations WHERE name = 'Recovery Innovations Test'",
  );
  console.log("Cleared. paycor_config is now:", res.rows[0].paycor_config);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
