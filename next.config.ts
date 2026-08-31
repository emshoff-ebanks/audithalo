import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Build the CSP report-uri from the Sentry DSN so violations are collected
// alongside errors in the Sentry dashboard. Falls back to omitting the
// directive when the DSN isn't set (local dev).
function cspReportUri(): string {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return "";
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/\//g, "");
    const publicKey = url.username;
    return `; report-uri https://sentry.io/api/${projectId}/security/?sentry_key=${publicKey}`;
  } catch {
    return "";
  }
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
  "font-src 'self' https://cdn.fontshare.com",
  "img-src 'self' data:",
  "connect-src 'self' https://us.i.posthog.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
].join("; ");

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/**/*": ["./rules/**/*.yaml", "./rules/**/*.yml"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: csp + cspReportUri(),
          },
        ],
      },
    ];
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
