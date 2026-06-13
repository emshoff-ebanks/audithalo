"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Error boundary for /dashboard and its nested routes.
 *
 * Why this exists: if any server component under /dashboard throws — a DB
 * hiccup, a stale assignment, a rendering edge case — Next.js streams an
 * incomplete RSC payload. Mobile browsers (notably iOS Safari) can render
 * "This page couldn't load" instead of an actionable error. This boundary
 * catches the throw and replaces the in-flight render with a real page.
 *
 * Logs the error so it shows up in Vercel runtime logs.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] render error:", error);
    // Temporary 2026-06-12: post the client stack to the server so we can
    // read it in Vercel runtime logs. Sentry is disabled in prod; without
    // this we only see the Next.js digest, which can't be mapped back to
    // a source location. Remove after the calendar issue is rooted out.
    try {
      void fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error?.message,
          stack: error?.stack,
          digest: error?.digest,
          url: typeof window !== "undefined" ? window.location.href : null,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
        keepalive: true,
      });
    } catch {
      // Reporting must never break the error UI.
    }
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="h-6 w-6 shrink-0 text-[color:var(--color-warning)] mt-0.5"
              strokeWidth={1.75}
            />
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">
                Something went wrong loading your dashboard.
              </h1>
              <p className="mt-2 text-sm text-foreground/70">
                The page errored while loading your data. Try again — if the
                error keeps happening, sign out and back in, or contact
                support and quote the reference below.
              </p>
              {error.digest && (
                <p className="mt-3 font-mono text-xs text-foreground/50">
                  ref: {error.digest}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button onClick={() => reset()} size="sm">
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/account">
                <ArrowLeft className="h-3.5 w-3.5" />
                Go to account
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
