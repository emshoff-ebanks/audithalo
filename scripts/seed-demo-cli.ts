/**
 * CLI wrapper for the demo seed (`npm run seed:demo`). Loads .env.local first
 * so the @/lib/db module sees DATABASE_URL, then dynamic-imports the seed.
 *
 * Why dynamic import: ESM hoists static `import` statements to the top of the
 * module, which means `@/lib/db` would load BEFORE dotenv.config() runs and
 * throw on a missing DATABASE_URL. The dynamic import inside main() lets
 * dotenv populate the env before the db module evaluates.
 *
 * Runtime logic lives in src/lib/demo/seed.ts so it can be shared with the
 * /api/admin/reset-demo endpoint on prod.
 */
import dotenv from "dotenv";
import { resolve } from "node:path";

async function main() {
  dotenv.config({ path: resolve(process.cwd(), ".env.local") });

  const { runDemoSeed } = await import("@/lib/demo/seed");

  console.log("Seeding demo data (idempotent — clears any prior demo state first)...");
  const { supervisorId } = await runDemoSeed();
  console.log(
    `Done. Supervisor: demo-supervisor@audithalo.com (id ${supervisorId})`
  );
  console.log("  Password for all demo users: Demo1234!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
