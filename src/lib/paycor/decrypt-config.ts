import { decryptToken } from "@/lib/crypto";
import type { PaycorConfig } from "@/lib/db/schema";

export function decryptPaycorConfig(config: PaycorConfig): PaycorConfig {
  return {
    ...config,
    apimSubscriptionKey: decryptToken(config.apimSubscriptionKey),
    oauthRefreshToken: config.oauthRefreshToken
      ? decryptToken(config.oauthRefreshToken)
      : undefined,
    oauthAccessToken: config.oauthAccessToken
      ? decryptToken(config.oauthAccessToken)
      : undefined,
    sftpPrivateKey: config.sftpPrivateKey
      ? decryptToken(config.sftpPrivateKey)
      : undefined,
  };
}
