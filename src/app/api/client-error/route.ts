// Temporary debug endpoint (added 2026-06-12).
//
// The dashboard error boundary catches client-render throws but only
// surfaces a Next.js digest to the user — nowhere to see the actual
// error message + stack without Sentry, which is currently disabled in
// prod. This endpoint accepts POST {message, stack, digest, url, ua}
// and console.errors it so the trace lands in Vercel runtime logs.
//
// Plan: read the log, fix the underlying error, then delete this route.

import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          message?: string;
          stack?: string;
          digest?: string;
          url?: string;
          userAgent?: string;
        }
      | null;
    if (!body) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    console.error(
      "[client-error]",
      JSON.stringify({
        message: body.message ?? null,
        digest: body.digest ?? null,
        url: body.url ?? null,
        userAgent: body.userAgent ?? null,
        // truncate the stack to a reasonable size to keep the log entry
        // readable
        stack:
          typeof body.stack === "string"
            ? body.stack.slice(0, 4_000)
            : null,
      })
    );
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[client-error] failed to record:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
