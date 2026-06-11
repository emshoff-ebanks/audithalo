/**
 * Shared OAuth handler logic for Microsoft + Google calendar integrations.
 *
 * The per-provider route handlers are thin shells that delegate here. This
 * keeps both providers' flows in lockstep — anything we fix in one provider
 * (state handling, error redirects, token persistence) gets the same
 * treatment in the other.
 */
import { eq, and, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { encryptToken } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import {
  getProviderConfig,
  getRedirectUri,
  loadProviderCredentials,
  type CalendarProvider,
} from "./oauth-config";
import { consumeOAuthState, issueOAuthState } from "./oauth-state";

/** Where the user lands after a connect attempt finishes (success or fail). */
const ACCOUNT_PAGE_HASH = "/dashboard/account#integrations";

/** Build the redirect to the provider's authorize endpoint. */
export async function handleOAuthStart(
  provider: CalendarProvider
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", absoluteAppUrl()));
  }

  const cfg = getProviderConfig(provider);
  const creds = loadProviderCredentials(provider);
  const state = await issueOAuthState(provider);

  const params = new URLSearchParams({
    client_id: creds.clientId,
    response_type: "code",
    redirect_uri: getRedirectUri(provider),
    scope: cfg.scopes.join(" "),
    state,
  });

  // Provider-specific knobs to make sure we always get a refresh token
  // back. Microsoft hands one out whenever offline_access is in scope;
  // Google requires access_type=offline + prompt=consent on every connect
  // (otherwise the second connect call only returns an access token).
  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
    params.set("include_granted_scopes", "true");
  } else {
    params.set("prompt", "consent");
  }

  return NextResponse.redirect(`${cfg.authUrl}?${params.toString()}`);
}

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

export async function handleOAuthCallback(
  provider: CalendarProvider,
  request: Request
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", absoluteAppUrl()));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const callbackState = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  if (providerError) {
    return redirectWithError(
      `${provider}_${providerError}`,
      url.searchParams.get("error_description")
    );
  }

  try {
    await consumeOAuthState(provider, callbackState);
  } catch {
    return redirectWithError(`${provider}_state_mismatch`);
  }

  if (!code) {
    return redirectWithError(`${provider}_missing_code`);
  }

  const cfg = getProviderConfig(provider);
  const creds = loadProviderCredentials(provider);

  let tokens: TokenResponse;
  try {
    tokens = await exchangeCodeForTokens({
      tokenUrl: cfg.tokenUrl,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      code,
      redirectUri: getRedirectUri(provider),
    });
  } catch (err) {
    console.error(`[oauth ${provider}] token exchange failed:`, err);
    return redirectWithError(`${provider}_token_exchange_failed`);
  }

  let accountEmail: string | null = null;
  try {
    accountEmail = await fetchAccountEmail(provider, tokens.access_token);
  } catch (err) {
    // Non-fatal — we can still store the tokens, just without the
    // display email. Surface in logs for ops.
    console.warn(`[oauth ${provider}] userinfo fetch failed:`, err);
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const grantedScopes = tokens.scope ? tokens.scope.split(/\s+/) : cfg.scopes;

  // Soft-disconnect any prior active row for (user, provider) so the
  // partial unique index (active row per pair) doesn't collide on insert.
  await db
    .update(schema.userCalendarIntegrations)
    .set({ disconnectedAt: new Date() })
    .where(
      and(
        eq(schema.userCalendarIntegrations.userId, session.user.id),
        eq(schema.userCalendarIntegrations.provider, provider),
        isNull(schema.userCalendarIntegrations.disconnectedAt)
      )
    );

  await db.insert(schema.userCalendarIntegrations).values({
    userId: session.user.id,
    provider,
    accountEmail,
    accessToken: encryptToken(tokens.access_token),
    refreshToken: tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null,
    expiresAt,
    scopes: grantedScopes,
  });

  const successUrl = new URL(ACCOUNT_PAGE_HASH, absoluteAppUrl());
  successUrl.searchParams.set("connected", provider);
  return NextResponse.redirect(successUrl);
}

async function exchangeCodeForTokens(input: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  });
  const res = await fetch(input.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

async function fetchAccountEmail(
  provider: CalendarProvider,
  accessToken: string
): Promise<string | null> {
  const cfg = getProviderConfig(provider);
  const res = await fetch(cfg.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`userinfo HTTP ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  if (provider === "microsoft") {
    // Graph /me prefers "mail"; falls back to UPN (which is usually an email
    // but not guaranteed — keep both for diagnostics in the row).
    return (
      (typeof data.mail === "string" && data.mail) ||
      (typeof data.userPrincipalName === "string" &&
        data.userPrincipalName) ||
      null
    );
  }
  // Google
  return typeof data.email === "string" ? data.email : null;
}

function absoluteAppUrl(): URL {
  const raw = process.env.APP_URL;
  if (!raw) throw new Error("APP_URL is not set.");
  return new URL(raw);
}

function redirectWithError(code: string, detail?: string | null): NextResponse {
  const target = new URL(ACCOUNT_PAGE_HASH, absoluteAppUrl());
  target.searchParams.set("error", code);
  if (detail) {
    target.searchParams.set("error_detail", detail.slice(0, 200));
  }
  return NextResponse.redirect(target);
}
