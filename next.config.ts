import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/**/*": ["./rules/**/*.yaml", "./rules/**/*.yml"],
  },
  async redirects() {
    return [
      {
        source: "/for-practices",
        destination: "/for-group-practices",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Build-time options
  silent: !process.env.CI, // suppress source-map upload logs in dev
  org: process.env.SENTRY_ORG, // set in Vercel env when ready
  project: process.env.SENTRY_PROJECT, // set in Vercel env when ready
  authToken: process.env.SENTRY_AUTH_TOKEN, // needed for source map upload
  // Wider client file upload — better stack-trace resolution for chunked builds.
  widenClientFileUpload: true,
  // Tunnel route — Sentry events get proxied through /monitoring so ad-blockers
  // and corporate proxies that block sentry.io don't drop error reports.
  // proxy.ts excludes this path from host-rewriting via the matcher below.
  tunnelRoute: "/monitoring",
  // Delete source maps after upload so they're not served publicly
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  // Disable telemetry to Sentry about CLI usage
  telemetry: false,
  // Don't fail the build if source map upload fails (env vars missing in early days)
  errorHandler: (err: Error) => {
    if (process.env.NODE_ENV === "production") {
      console.warn("[sentry] source map upload skipped:", err.message);
    }
  },
});
