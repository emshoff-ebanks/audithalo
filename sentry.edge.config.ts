/**
 * Edge-runtime Sentry init. Loaded by instrumentation.ts when
 * NEXT_RUNTIME === "edge" (middleware/proxy + edge route handlers).
 *
 * Following sentry-nextjs-sdk SKILL.md (Apache-2.0).
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    enableLogs: true,
    enabled: process.env.NODE_ENV === "production",
  });
}
