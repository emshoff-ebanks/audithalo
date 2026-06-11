/**
 * OAuth token refresh for stored calendar integrations.
 *
 * When an access token is within {@link REFRESH_SKEW_MS} of expiry, we
 * trade the refresh token for a new access token at the provider's token
 * endpoint, re-encrypt both, and update the row in place.
 *
 * Provider quirks:
 *   - Microsoft rotates refresh tokens on every refresh (the new token
 *     replaces the old). We always persist the response's refresh_token
 *     when present.
 *   - Google returns a refresh_token ONLY on the very first consent
 *     (when access_type=offline + prompt=consent). Subsequent refreshes
 *     omit it; we keep the existing one.
 *
 * If refresh fails (refresh token revoked, scope changed, etc.) the row
 * stays — but we throw {@link IntegrationRefreshError} so the caller can
 * surface a "reconnect required" state.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import {
  getProviderConfig,
  loadProviderCredentials,
  type CalendarProvider,
} from "./oauth-config";

/** Refresh when this many ms or fewer remain on the access token. */
const REFRESH_SKEW_MS = 60_000; // 1 minute

export class IntegrationRefreshError extends Error {
  constructor(message: string, readonly provider: CalendarProvider) {
    super(message);
    this.name = "IntegrationRefreshError";
  }
}

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

export type IntegrationRow = typeof schema.userCalendarIntegrations.$inferSelect;

/**
 * Return a usable plaintext access token for the integration. Refreshes
 * via the provider's token endpoint if the stored token is expired or
 * within the skew window. Updates the DB row on refresh.
 */
export async function getUsableAccessToken(
  row: IntegrationRow
): Promise<string> {
  const provider = row.provider as CalendarProvider;

  // Fast path: token has comfortable runway left.
  if (
    row.expiresAt &&
    row.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS
  ) {
    return decryptToken(row.accessToken);
  }

  if (!row.refreshToken) {
    throw new IntegrationRefreshError(
      `${provider} access token expired and no refresh token on file — reconnect required.`,
      provider
    );
  }

  const cfg = getProviderConfig(provider);
  const creds = loadProviderCredentials(provider);
  const refreshToken = decryptToken(row.refreshToken);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new IntegrationRefreshError(
      `${provider} token refresh failed (HTTP ${res.status}): ${text.slice(0, 200)}`,
      provider
    );
  }

  const tokens = (await res.json()) as TokenResponse;
  if (!tokens.access_token) {
    throw new IntegrationRefreshError(
      `${provider} refresh response missing access_token.`,
      provider
    );
  }

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const updates: Partial<IntegrationRow> = {
    accessToken: encryptToken(tokens.access_token),
    expiresAt: newExpiresAt,
  };
  // Microsoft rotates the refresh token; Google usually doesn't return one
  // here. Either way: if the server gave us a new refresh token, persist it.
  if (tokens.refresh_token) {
    updates.refreshToken = encryptToken(tokens.refresh_token);
  }
  if (tokens.scope) {
    updates.scopes = tokens.scope.split(/\s+/);
  }

  await db
    .update(schema.userCalendarIntegrations)
    .set(updates)
    .where(eq(schema.userCalendarIntegrations.id, row.id));

  return tokens.access_token;
}
