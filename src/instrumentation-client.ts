/**
 * Browser-runtime Sentry init. Replaces the older sentry.client.config.ts
 * pattern. Loaded automatically by Next.js on every client navigation.
 *
 * Following sentry-nextjs-sdk SKILL.md (Apache-2.0):
 *   https://github.com/getsentry/sentry-for-ai/blob/main/skills/sentry-nextjs-sdk/SKILL.md
 *
 * AuditHalo-specific tuning:
 *   - Replay: 0% session sampling + 100% on error. We don't need always-on
 *     replay; we just want to see what the user did right before the crash.
 *   - maskAllText + blockAllMedia: defense-in-depth against capturing
 *     supervisee names, session notes, or PHI in replay recordings.
 *   - tracesSampleRate: 0.1 in production; bump later once we know baseline.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    // Include IP + request headers + cookies in events. OK because:
    // - Sentry data flow is one-way and access-controlled to org members
    // - PHI in URLs / cookies is already minimized (we use opaque UUIDs)
    sendDefaultPii: true,

    // 0.1 in prod = ~10% of transactions; bump up after we know the rate.
    // 1.0 in dev so local errors always carry a trace.
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

    // Session Replay — only record sessions where something errored.
    // Cheaper than continuous capture and gives us the last 60 seconds.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

    // Structured logs via Sentry.logger.* — see SKILL.md "Logging".
    enableLogs: true,

    integrations: [
      Sentry.replayIntegration({
        // Mask all text — supervisee names, session notes, attestation values.
        maskAllText: true,
        // Block all images and video — evidence-package thumbnails, etc.
        blockAllMedia: true,
      }),
    ],

    // Don't pollute production reports with localhost noise from `npm run dev`.
    enabled: process.env.NODE_ENV === "production",
  });
}

// App Router navigation tracing. Wires client navigations into the same
// trace that the server render started, so we get end-to-end spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
