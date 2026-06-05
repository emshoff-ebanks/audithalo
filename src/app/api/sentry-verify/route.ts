import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY — Sentry SDK verification endpoint. Two capture paths so we
 * can pinpoint where the wire is broken if the event doesn't land:
 *   (a) explicit Sentry.captureException + flush (independent of any hook)
 *   (b) throw, which onRequestError should re-capture via the canonical
 *       SKILL.md pattern in instrumentation.ts
 *
 * Removed after we've seen the event land in Sentry Issues.
 */
export async function GET() {
  const err = new Error(
    "[sentry-verify] intentional verification throw — safe to ignore"
  );
  // (a) Explicit capture: doesn't depend on onRequestError firing.
  Sentry.captureException(err);
  // Flush before the serverless function terminates. Up to 2s wait.
  await Sentry.flush(2000);
  // (b) Throw so onRequestError can also capture it (we'll see two events
  // in Sentry if both paths work).
  throw err;
}

export async function POST() {
  return NextResponse.json({
    ok: true,
    note: "GET this endpoint to trigger a Sentry verification event. Then delete the route.",
  });
}
