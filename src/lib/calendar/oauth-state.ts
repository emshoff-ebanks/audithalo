/**
 * CSRF protection for the OAuth dance.
 *
 * On /start: generate 32 random bytes (base64url), drop into an HttpOnly
 * Secure SameSite=Lax cookie scoped to /api/auth/<provider>, include the
 * same value as the `state` query param on the auth URL.
 *
 * On /callback: read the cookie, compare to the `state` param. If they
 * don't match (or the cookie is missing), refuse to exchange the code —
 * an attacker who can trick a user into clicking a forged callback URL
 * gets nowhere without the matching cookie value.
 *
 * Cookie lifetime: 10 minutes. Plenty of time for a slow consent screen,
 * short enough that a stolen state value can't be replayed later.
 */
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import type { CalendarProvider } from "./oauth-config";

const STATE_TTL_SECONDS = 60 * 10; // 10 min

function cookieName(provider: CalendarProvider): string {
  return `ah_oauth_state_${provider}`;
}

/** Generate and persist a one-time state value. Returns the value. */
export async function issueOAuthState(
  provider: CalendarProvider
): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  const jar = await cookies();
  jar.set({
    name: cookieName(provider),
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/api/auth/${provider}`,
    maxAge: STATE_TTL_SECONDS,
  });
  return state;
}

/**
 * Read the cookie and verify the callback state matches. Always clears
 * the cookie afterwards (single-use). Throws on mismatch.
 */
export async function consumeOAuthState(
  provider: CalendarProvider,
  callbackState: string | null
): Promise<void> {
  const jar = await cookies();
  const stored = jar.get(cookieName(provider))?.value;
  // Clear the cookie eagerly so a replay (even of a successful state) fails.
  jar.set({
    name: cookieName(provider),
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/api/auth/${provider}`,
    maxAge: 0,
  });
  if (!stored || !callbackState || stored !== callbackState) {
    throw new Error("OAuth state mismatch — refusing to complete the flow.");
  }
}
