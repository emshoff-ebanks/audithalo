import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Conservative sampling for v1 — bump up after we know the baseline rate
    tracesSampleRate: 0.1,
    // Replay only on errors (cheaper than continuous capture)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Don't pollute production reports with localhost noise
    enabled: process.env.NODE_ENV === "production",
  });
}
