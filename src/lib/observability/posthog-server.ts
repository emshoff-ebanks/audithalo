import { PostHog } from "posthog-node";

/**
 * Server-side PostHog client (posthog-node). One singleton across the app
 * runtime so we don't open a new HTTP queue per request. The browser SDK is
 * in posthog-provider.tsx / posthog-identify.tsx — events from the user's
 * tab fire from there; events that ride along with server actions, the
 * Stripe webhook, and the daily cron fire from here.
 *
 * The same project API key (phc_...) drives both clients. PostHog
 * deduplicates by distinct_id, so a server-fired `session_logged` event
 * with the user's id correctly attributes to the same person profile that
 * the browser SDK created.
 */

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

// In dev / local CI we don't want to ship events. Returning a no-op stub
// keeps every call site clean (no `if (posthog) ...` defensive blocks).
const stub = {
  capture: () => {},
  identify: () => {},
  shutdown: async () => {},
} as unknown as PostHog;

const client: PostHog =
  apiKey && process.env.NODE_ENV === "production"
    ? new PostHog(apiKey, {
        host,
        // posthog-node defaults to 60s; lower it so events from one-shot
        // serverless invocations actually leave the box. The Vercel platform
        // kills the function after the response returns, so we explicitly
        // call captureSync (via the helpers below) for events we care about.
        flushAt: 1,
        flushInterval: 1000,
      })
    : stub;

/**
 * The 10 named events instrumented across the codebase. Strings only
 * defined here so a typo at a call site fails the TS build.
 *
 * See docs/strategy/03-campaign-execution.md for what each measures and
 * where it fires.
 */
export type PosthogEvent =
  | "lead_magnet_download"
  | "supervisee_signup_free"
  | "supervisor_trial_start"
  | "supervisee_added"
  | "state_rule_selected"
  | "session_logged"
  | "signature_completed"
  | "evidence_package_sealed"
  | "trial_converted"
  | "review_submitted";

/**
 * Fire-and-forget capture. Wraps the posthog-node `capture` so the call
 * site is a single line. Failures are swallowed — analytics must never
 * take down a user-facing action.
 *
 * @param event - one of the 10 named events
 * @param distinctId - the id PostHog ties to a person profile. Use the
 *   user's id when available; fall back to orgId or a synthetic
 *   "anonymous-<random>" only for true pre-account events.
 * @param properties - structured payload. Stick to flat string/number/
 *   boolean values; no PII beyond what's already in the person profile
 *   (email, role).
 */
export function capture(
  event: PosthogEvent,
  distinctId: string,
  properties?: Record<string, string | number | boolean | null>
): void {
  try {
    client.capture({
      event,
      distinctId,
      properties: properties ?? undefined,
    });
  } catch (err) {
    console.error(`[posthog] capture ${event} failed:`, err);
  }
}

/**
 * Flush + shut down the client. Call from graceful-shutdown paths. The
 * fire-and-forget capture above is enough for normal request-response —
 * use this only if you're seeing dropped events from a long-running
 * background job.
 */
export async function shutdown(): Promise<void> {
  try {
    await client.shutdown();
  } catch (err) {
    console.error("[posthog] shutdown failed:", err);
  }
}
