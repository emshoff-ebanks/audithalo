/**
 * Static OAuth provider config used by the start + callback routes for
 * Microsoft (Entra ID) and Google. Centralized so both routes — and any
 * future token-refresh helper — pull from one source.
 *
 * Scopes are picked to cover Phase 1 (calendar event + meeting link) and
 * Phase 4 (conflict detection, read scope). Teams transcript scope is
 * deferred to Phase 6 because it needs admin consent and would force a
 * re-consent flow if added later — accepting that trade for now to keep
 * the connect UX a single-click.
 *
 * See docs/strategy/08-scheduling-and-calendar.md.
 */

export type CalendarProvider = "microsoft" | "google";

export type ProviderOAuthConfig = {
  provider: CalendarProvider;
  /** Authorization endpoint (where we send the user to consent). */
  authUrl: string;
  /** Token endpoint (where we exchange the code for tokens). */
  tokenUrl: string;
  /** Endpoint we hit after token exchange to read the user's identity. */
  userInfoUrl: string;
  /** Space-separated scope string (provider-specific delimiter conventions). */
  scopes: string[];
  /** env var names we read at runtime. Read on demand — never at module scope. */
  envClientIdKey: string;
  envClientSecretKey: string;
};

export const PROVIDERS: Record<CalendarProvider, ProviderOAuthConfig> = {
  microsoft: {
    provider: "microsoft",
    // /common endpoint accepts any Entra ID tenant + personal MS accounts.
    // The app must be registered as multi-tenant in Entra to allow this.
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/v1.0/me",
    scopes: [
      "openid",
      "email",
      "profile",
      "offline_access",
      "Calendars.ReadWrite",
      "OnlineMeetings.ReadWrite",
    ],
    envClientIdKey: "MS_CLIENT_ID",
    envClientSecretKey: "MS_CLIENT_SECRET",
  },
  google: {
    provider: "google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    envClientIdKey: "GOOGLE_CLIENT_ID",
    envClientSecretKey: "GOOGLE_CLIENT_SECRET",
  },
};

export function getProviderConfig(provider: CalendarProvider): ProviderOAuthConfig {
  return PROVIDERS[provider];
}

export type ProviderCredentials = {
  clientId: string;
  clientSecret: string;
};

/** Read provider credentials from env. Throws if either is missing. */
export function loadProviderCredentials(
  provider: CalendarProvider
): ProviderCredentials {
  const cfg = PROVIDERS[provider];
  const clientId = process.env[cfg.envClientIdKey];
  const clientSecret = process.env[cfg.envClientSecretKey];
  if (!clientId || !clientSecret) {
    throw new Error(
      `${provider} OAuth not configured: missing ${cfg.envClientIdKey} or ${cfg.envClientSecretKey}.`
    );
  }
  return { clientId, clientSecret };
}

/** Absolute redirect URI for a provider, derived from APP_URL. */
export function getRedirectUri(provider: CalendarProvider): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is not set — required for OAuth redirect URI.");
  }
  return `${appUrl.replace(/\/$/, "")}/api/auth/${provider}/callback`;
}
