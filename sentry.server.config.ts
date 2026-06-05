/**
 * Node.js server-runtime Sentry init. Loaded by instrumentation.ts when
 * NEXT_RUNTIME === "nodejs".
 *
 * Following sentry-nextjs-sdk SKILL.md (Apache-2.0):
 *   https://github.com/getsentry/sentry-for-ai/blob/main/skills/sentry-nextjs-sdk/SKILL.md
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// TEMPORARY diagnostic — confirms this file is being imported by
// instrumentation.ts on cold-start. Remove once Sentry is verified.
console.log(
  "[sentry-server-config] module load — dsn set:",
  !!dsn,
  "node_env:",
  process.env.NODE_ENV
);

if (dsn) {
  Sentry.init({
    dsn,

    // Include IP + request headers in server events.
    sendDefaultPii: true,

    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

    // Attach local variable values to stack frames — invaluable for
    // debugging server-action and route-handler throws.
    includeLocalVariables: true,

    // Structured logs via Sentry.logger.* (Sentry Logs product).
    enableLogs: true,

    enabled: process.env.NODE_ENV === "production",
    debug: true, // TEMPORARY — surface SDK init/send activity in Vercel logs
  });
  console.log("[sentry-server-config] Sentry.init() called");
}
