import { NextRequest, NextResponse } from "next/server";

// Host-based routing. URL bar stays clean; the rewrite is internal.
//   audithalo.com / www.audithalo.com / *.vercel.app  -> /marketing/*
//   app.audithalo.com / app.localhost / app.*         -> /app/*
//
// Auth cookies should be scoped host-only to app.audithalo.com so they are
// never sent to the marketing host. Set-Cookie on app routes must NOT include
// a Domain attribute (Next.js cookies() default is host-only — keep it that way).

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const url = req.nextUrl;

  // Don't double-rewrite if path is already namespaced.
  if (url.pathname.startsWith("/marketing") || url.pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  const isAppHost =
    host === "app.audithalo.com" ||
    host === "app.localhost" ||
    host.startsWith("app.");

  const namespace = isAppHost ? "/app" : "/marketing";
  const rewritten = url.clone();
  rewritten.pathname = namespace + url.pathname;
  return NextResponse.rewrite(rewritten);
}

export const config = {
  // Skip Next internals, static files, and API routes. Anything with a file extension
  // (favicon.ico, images, fonts) and /api/* resolves directly without host-based routing.
  matcher: ["/((?!_next/static|_next/image|api|favicon.ico|.*\\..*).*)"],
};
