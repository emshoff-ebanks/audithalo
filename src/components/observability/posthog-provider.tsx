"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

    if (!key) return; // No key = silent no-op
    if (process.env.NODE_ENV !== "production") return; // Skip in dev to avoid polluting analytics

    posthog.init(key, {
      api_host: host,
      // Capture page views automatically
      capture_pageview: true,
      // Don't capture form values by default — privacy posture for a clinical SaaS
      autocapture: {
        css_selector_allowlist: [],
        dom_event_allowlist: ["click", "submit"],
      },
      // Reduce session replay risk for clinical compliance product
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
      },
      // Person profiles only for identified users (saves quota)
      person_profiles: "identified_only",
    });
  }, []);

  return <>{children}</>;
}
