import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY — Sentry SDK verification endpoint. Throws on GET so we can
 * confirm the SDK captures server-side exceptions in production. Remove
 * after we've seen the event land in Sentry Issues.
 *
 * Returns its own message on POST so the route is harmless if anyone hits
 * it by mistake.
 */
export async function GET() {
  // Throw outside the Response so Next.js's onRequestError fires.
  throw new Error("[sentry-verify] intentional verification throw — safe to ignore");
}

export async function POST() {
  return NextResponse.json({
    ok: true,
    note: "GET this endpoint to trigger a Sentry verification event. Then delete the route.",
  });
}
