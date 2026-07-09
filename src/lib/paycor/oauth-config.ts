export type PaycorEnvironment = "sandbox" | "production";

const ENDPOINTS = {
  sandbox: {
    authUrl: "https://secure-sandbox.paycor.com/connect/authorize",
    tokenUrl: "https://secure-sandbox.paycor.com/connect/token",
  },
  production: {
    authUrl: "https://secure.paycor.com/connect/authorize",
    tokenUrl: "https://secure.paycor.com/connect/token",
  },
} as const;

export const PAYCOR_SCOPES = ["openid", "profile", "email"];

export function getPaycorEndpoints(environment: PaycorEnvironment) {
  return ENDPOINTS[environment];
}

export function loadPaycorCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.PAYCOR_CLIENT_ID;
  const clientSecret = process.env.PAYCOR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Paycor OAuth not configured: missing PAYCOR_CLIENT_ID or PAYCOR_CLIENT_SECRET.",
    );
  }
  return { clientId, clientSecret };
}

export function getPaycorRedirectUri(): string {
  if (process.env.PAYCOR_REDIRECT_URI) {
    return process.env.PAYCOR_REDIRECT_URI;
  }
  const appUrl = process.env.APP_URL ?? "https://app.audithalo.com";
  return `${appUrl.replace(/\/$/, "")}/api/paycor/callback`;
}
