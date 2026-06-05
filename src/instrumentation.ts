import * as Sentry from "@sentry/nextjs";

// NOTE: paths are relative to this file (src/instrumentation.ts), so we
// have to go up one directory to reach the repo-root sentry.*.config.ts
// files. Next.js 16 with src/ requires this instrumentation file to live
// inside src/ — putting it at repo root means it's silently ignored.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Canonical Sentry hook for App Router server errors per
 * sentry-nextjs-sdk SKILL.md. Passing the SDK's exported handler directly
 * (rather than wrapping it) avoids two pitfalls:
 *   1. Dynamic import on every error path adds latency that may exceed
 *      the serverless invocation lifetime, dropping events.
 *   2. Manual wrapping risks omitting the proper flush() before return.
 */
export const onRequestError = Sentry.captureRequestError;
