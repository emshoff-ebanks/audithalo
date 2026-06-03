import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  // Forward Next.js's caught render/route/action errors to Sentry.
  // If Sentry isn't initialized (no DSN), this is a no-op.
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, {
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
