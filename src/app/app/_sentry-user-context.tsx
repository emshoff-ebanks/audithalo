"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Tags every Sentry event (including Session Replays) with the current user's
 * id, email, and role so we can filter / search in the Sentry dashboard by
 * "all errors hit by user X" or "all errors for role=supervisor".
 *
 * Server-side errors carry user context automatically via sendDefaultPii +
 * Next.js's onRequestError capturing the request cookies. This component
 * covers the client-side surface (Replay sessions, client-render errors,
 * any user-triggered exception).
 *
 * Mounted from the app layout once auth() has resolved.
 */
export function SentryUserContext({
  userId,
  email,
  role,
}: {
  userId: string;
  email: string;
  role: string;
}) {
  useEffect(() => {
    Sentry.setUser({ id: userId, email, role });
    return () => {
      // Clear on unmount (e.g. signout) so a subsequent session doesn't
      // inherit the prior user.
      Sentry.setUser(null);
    };
  }, [userId, email, role]);
  return null;
}
