import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership, isHrAdmin } from "@/lib/authz";
import { encryptToken } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import type { PaycorConfig } from "@/lib/db/schema";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import {
  getPaycorEndpoints,
  loadPaycorCredentials,
  getPaycorRedirectUri,
} from "@/lib/paycor/oauth-config";
import { consumePaycorOAuthState } from "@/lib/paycor/oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function absoluteAppUrl(): URL {
  return new URL(process.env.APP_URL ?? "https://app.audithalo.com");
}

function redirectWithError(code: string, detail?: string | null): NextResponse {
  const target = new URL("/dashboard/settings/integrations", absoluteAppUrl());
  target.searchParams.set("error", code);
  if (detail) {
    target.searchParams.set("error_detail", detail.slice(0, 200));
  }
  return NextResponse.redirect(target);
}

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", absoluteAppUrl()));
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isHrAdmin(membership.role)) {
    return redirectWithError("unauthorized");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const callbackState = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  if (providerError) {
    return redirectWithError(
      `paycor_${providerError}`,
      url.searchParams.get("error_description"),
    );
  }

  try {
    await consumePaycorOAuthState(callbackState);
  } catch {
    return redirectWithError("paycor_state_mismatch");
  }

  if (!code) {
    return redirectWithError("paycor_missing_code");
  }

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, membership.orgId),
  });

  if (!org?.paycorConfig) {
    return redirectWithError(
      "paycor_no_config",
      "Start the connection from Settings first.",
    );
  }

  const environment = org.paycorConfig.environment;
  const endpoints = getPaycorEndpoints(environment);
  const creds = loadPaycorCredentials();

  let tokens: TokenResponse;
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getPaycorRedirectUri(),
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });

    const res = await fetch(endpoints.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[paycor oauth] token exchange failed:", res.status, text);
      return redirectWithError("paycor_token_exchange_failed");
    }

    tokens = (await res.json()) as TokenResponse;
  } catch (err) {
    console.error("[paycor oauth] token exchange error:", err);
    return redirectWithError("paycor_token_exchange_failed");
  }

  if (!tokens.access_token) {
    return redirectWithError("paycor_missing_access_token");
  }

  const updatedConfig: PaycorConfig = {
    ...org.paycorConfig,
    oauthAccessToken: encryptToken(tokens.access_token),
    oauthRefreshToken: tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : org.paycorConfig.oauthRefreshToken,
    tokenExpiresAt: new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString(),
    connectedAt: new Date().toISOString(),
    connectedByUserId: session.user.id,
  };

  await db
    .update(schema.organizations)
    .set({ paycorConfig: updatedConfig })
    .where(eq(schema.organizations.id, membership.orgId));

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.PAYCOR_CONNECTED,
      resourceType: "organization",
      resourceId: membership.orgId,
      details: {
        legalEntityId: org.paycorConfig.legalEntityId,
        environment,
        method: "oauth",
      },
    });
  } catch {
    /* audit failures must not break the flow */
  }

  const successUrl = new URL(
    "/dashboard/settings/integrations",
    absoluteAppUrl(),
  );
  successUrl.searchParams.set("connected", "paycor");
  return NextResponse.redirect(successUrl);
}
