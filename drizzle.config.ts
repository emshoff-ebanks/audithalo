import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Match Next.js convention: .env.local takes precedence, then .env.
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
