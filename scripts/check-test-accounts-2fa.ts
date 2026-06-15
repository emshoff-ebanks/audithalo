import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const sql = neon(url);

  const emails = [
    "damon-test-hr@audithalo.test",
    "damon-test-supervisor@audithalo.test",
    "damon-test-supervisee@audithalo.test",
  ];

  const rows = await sql`
    select email,
           (totp_enabled_at is not null) as twofa_enabled,
           (totp_secret is not null)     as has_secret,
           (totp_backup_codes is not null) as has_backup_codes
    from users
    where email = any(${emails}::text[])
    order by email
  `;

  console.table(rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
