import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const org = await pool.query(
    "SELECT id, name, paycor_config FROM organizations WHERE name = 'Recovery Innovations Test'",
  );

  if (org.rows.length === 0) {
    console.error("RI test org not found");
    process.exit(1);
  }

  console.log("Found org:", org.rows[0].id, org.rows[0].name);
  console.log("Current paycor_config:", org.rows[0].paycor_config);

  const paycorConfig = {
    legalEntityId: "501234",
    sftpHost: "sftp.paycor.test",
    sftpUser: "audithalo-ri",
    sftpBasePath: "/documents/supervision",
  };

  await pool.query(
    "UPDATE organizations SET paycor_config = $1 WHERE id = $2",
    [JSON.stringify(paycorConfig), org.rows[0].id],
  );

  console.log("Set paycor_config:", JSON.stringify(paycorConfig, null, 2));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
