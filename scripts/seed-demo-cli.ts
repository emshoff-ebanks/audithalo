/**
 * CLI wrapper for the demo seed (`npm run seed:demo`). Loads .env.local first
 * so the @/lib/db module sees DATABASE_URL, then defers to runDemoSeed.
 *
 * The runtime logic lives in src/lib/demo/seed.ts so it can be shared with
 * the /api/admin/reset-demo endpoint on prod.
 */
import dotenv from "dotenv";
import { resolve } from "node:path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { runDemoSeed } from "@/lib/demo/seed";

console.log("Seeding demo data (idempotent — clears any prior demo state first)...");

runDemoSeed()
  .then(({ supervisorId }) => {
    console.log(
      `Done. Supervisor: demo-supervisor@audithalo.com (id ${supervisorId})`
    );
    console.log("  Password for all demo users: Demo1234!");
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
