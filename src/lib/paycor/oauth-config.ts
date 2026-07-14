export type PaycorEnvironment = "sandbox" | "production";

const ENDPOINTS = {
  sandbox: {
    authUrl: "https://hcm-demo.paycor.com/AppActivation/Authorize",
    apiBase: "https://apis-sandbox.paycor.com",
  },
  production: {
    authUrl: "https://hcm.paycor.com/AppActivation/Authorize",
    apiBase: "https://apis.paycor.com",
  },
} as const;

export const PAYCOR_SCOPES = ["openid", "profile", "email"];

export function getPaycorEndpoints(environment: PaycorEnvironment) {
  const ep = ENDPOINTS[environment];
  return {
    ...ep,
    tokenRefreshUrl: `${ep.apiBase}/v1/authenticationsupport/retrieveAccessTokenWithRefreshToken`,
  };
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
