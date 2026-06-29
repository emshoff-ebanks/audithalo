/**
 * Vitest setup — runs before any test file.
 *
 * Loads .env.local so test files that transitively import
 * `src/lib/db/index.ts` (which throws on missing DATABASE_URL at
 * module-load time) can spin up. Without this, ~5 test files fail
 * during import resolution instead of running their test suites.
 *
 * Safe in CI: dotenv silently no-ops when the file doesn't exist,
 * leaving any externally-set env vars (e.g. from `npm test` invoked
 * with `DATABASE_URL=...`) untouched.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
