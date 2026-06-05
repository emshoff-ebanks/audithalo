"use client";

/**
 * Root error boundary — catches throws in the root layout, the proxy, and
 * any React render error that escapes the route-segment error.tsx files
 * (e.g. /app/dashboard/error.tsx). Without this, those errors render the
 * generic Next.js 500 page with no telemetry.
 *
 * Per sentry-nextjs-sdk SKILL.md, must:
 *   - be a Client Component ("use client" first line),
 *   - call Sentry.captureException(error) inside useEffect,
 *   - render <html><body> at minimum (this IS the root html/body).
 *
 * Source: https://github.com/getsentry/sentry-for-ai/blob/main/skills/sentry-nextjs-sdk/SKILL.md
 */

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
