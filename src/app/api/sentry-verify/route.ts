import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY — diagnostic + verification.
 *
 * GET ?diag=1 — return server-side env+SDK state so we can pinpoint why
 *               the SDK isn't shipping events. Safe to expose: DSN prefix
 *               only, no auth token.
 *
 * GET (no query) — explicit captureException + flush, then throw. If the
 *                   DSN is right, this should produce events in Sentry.
 *
 * Removed after we've seen Sentry capture an event.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("diag") === "1") {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    const client = Sentry.getClient();
    return NextResponse.json({
      ok: true,
      dsnSet: !!dsn,
      dsnPrefix: dsn ? dsn.slice(0, 40) + "..." : null,
      dsnLength: dsn?.length ?? 0,
      dsnHasWhitespace: dsn ? /\s/.test(dsn) : false,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      sentryClientInitialized: !!client,
      sentryClientDsn: client?.getDsn?.()?.host ?? null,
      sentryClientPath: client?.getDsn?.()?.path ?? null,
      sentryClientProjectId: client?.getDsn?.()?.projectId ?? null,
    });
  }

  const err = new Error(
    "[sentry-verify] intentional verification throw — safe to ignore"
  );
  Sentry.captureException(err);
  await Sentry.flush(2000);
  throw err;
}

export async function POST() {
  return NextResponse.json({
    ok: true,
    note: "GET this endpoint to trigger a Sentry verification event. Add ?diag=1 for SDK state diagnostics.",
  });
}
