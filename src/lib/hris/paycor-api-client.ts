import type { PaycorConfig } from "@/lib/db/schema";
import {
  getPaycorEndpoints,
  loadPaycorCredentials,
} from "@/lib/paycor/oauth-config";
import type { PaycorEmployee, PaycorEmploymentStatus } from "./types";
import type { PaycorProvider, PaycorEmployeeStatus } from "./paycor-provider";

const BASE_URLS = {
  sandbox: "https://apis-sandbox.paycor.com",
  production: "https://apis.paycor.com",
} as const;

const HEALTH_PING_PATH = "/api/Health/ping";

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export type TokenRefreshCallback = (tokens: {
  oauthAccessToken: string;
  oauthRefreshToken: string;
  tokenExpiresAt: string;
}) => Promise<void>;

export class PaycorApiClient implements PaycorProvider {
  private config: PaycorConfig;
  private baseUrl: string;
  private onTokenRefresh?: TokenRefreshCallback;

  constructor(config: PaycorConfig, onTokenRefresh?: TokenRefreshCallback) {
    this.config = config;
    this.baseUrl = BASE_URLS[config.environment];
    this.onTokenRefresh = onTokenRefresh;
  }

  async fetchEmployees(legalEntityId: string): Promise<PaycorEmployee[]> {
    const employees: PaycorEmployee[] = [];
    let continuationToken: string | null = null;

    do {
      const params = new URLSearchParams({ include: "All" });
      if (continuationToken) {
        params.set("continuationToken", continuationToken);
      }

      const url = `${this.baseUrl}/v1/legalentities/${legalEntityId}/employees?${params}`;
      const data = await this.request<EmployeeListResponse>(url);

      if (data.records) {
        for (const record of data.records) {
          employees.push(flattenEmployee(record));
        }
      }

      continuationToken = data.hasMoreResults
        ? (data.continuationToken ?? null)
        : null;
    } while (continuationToken);

    return employees;
  }

  async fetchEmployeeStatus(employeeId: string): Promise<PaycorEmployeeStatus> {
    const url = `${this.baseUrl}/v1/employees/${employeeId}?include=Status`;
    const data = await this.request<EmployeeRecord>(url);

    return {
      employeeId: data.id,
      status: (data.statusData?.status ?? "Active") as PaycorEmploymentStatus,
      leaveStartDate: data.statusData?.leaveStartDate
        ? new Date(data.statusData.leaveStartDate)
        : null,
      leaveReason: data.statusData?.leaveReason ?? null,
    };
  }

  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.request<unknown>(`${this.baseUrl}${HEALTH_PING_PATH}`);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async request<T>(url: string, retried = false, rateLimitRetries = 0): Promise<T> {
    await this.ensureValidToken();

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.oauthAccessToken}`,
        "Ocp-Apim-Subscription-Key": this.config.apimSubscriptionKey,
        Accept: "application/json",
      },
    });

    if (res.status === 401 && !retried) {
      await this.refreshToken();
      return this.request<T>(url, true, rateLimitRetries);
    }

    if (res.status === 429 && rateLimitRetries < 3) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
      await sleep(retryAfter * 1000);
      return this.request<T>(url, retried, rateLimitRetries + 1);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PaycorApiError(
        `Paycor API ${res.status}: ${body || res.statusText}`,
        res.status,
      );
    }

    return res.json() as Promise<T>;
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.config.oauthAccessToken || !this.config.tokenExpiresAt) {
      await this.refreshToken();
      return;
    }

    const expiresAt = new Date(this.config.tokenExpiresAt).getTime();
    if (Date.now() >= expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
      await this.refreshToken();
    }
  }

  private async refreshToken(): Promise<void> {
    if (!this.config.oauthRefreshToken) {
      throw new PaycorApiError(
        "No refresh token available. Re-authenticate via Settings.",
        401,
      );
    }

    const creds = loadPaycorCredentials();
    const endpoints = getPaycorEndpoints(this.config.environment);

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.config.oauthRefreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });

    const res = await fetch(endpoints.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PaycorApiError(
        `Token refresh failed (${res.status}): ${body || res.statusText}`,
        res.status,
      );
    }

    const data = (await res.json()) as TokenRefreshResponse;

    this.config = {
      ...this.config,
      oauthAccessToken: data.access_token,
      oauthRefreshToken: data.refresh_token ?? this.config.oauthRefreshToken,
      tokenExpiresAt: new Date(
        Date.now() + data.expires_in * 1000,
      ).toISOString(),
    };

    if (this.onTokenRefresh) {
      await this.onTokenRefresh({
        oauthAccessToken: this.config.oauthAccessToken!,
        oauthRefreshToken: this.config.oauthRefreshToken!,
        tokenExpiresAt: this.config.tokenExpiresAt!,
      });
    }
  }
}

export class PaycorApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PaycorApiError";
  }
}

// ---------------------------------------------------------------------------
// Response types (from Paycor swagger — nested shape)
// ---------------------------------------------------------------------------

type EmployeeListResponse = {
  hasMoreResults: boolean;
  continuationToken?: string | null;
  records?: EmployeeRecord[] | null;
};

type EmployeeRecord = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: { emailAddress?: string | null } | null;
  statusData?: {
    status?: string | null;
    leaveStartDate?: string | null;
    leaveReason?: string | null;
  } | null;
  positionData?: {
    jobTitle?: string | null;
    manager?: { id?: string | null } | null;
  } | null;
  employmentDateData?: {
    hireDate?: string | null;
    terminationDate?: string | null;
  } | null;
};

type TokenRefreshResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

// ---------------------------------------------------------------------------
// Flatten nested Paycor response into our flat PaycorEmployee
// ---------------------------------------------------------------------------

function flattenEmployee(record: EmployeeRecord): PaycorEmployee {
  return {
    paycorEmployeeId: record.id,
    firstName: record.firstName ?? "",
    lastName: record.lastName ?? "",
    email: record.email?.emailAddress ?? "",
    status: (record.statusData?.status ?? "Active") as PaycorEmploymentStatus,
    jobTitle: record.positionData?.jobTitle ?? null,
    managerId: record.positionData?.manager?.id ?? null,
    hireDate: record.employmentDateData?.hireDate
      ? new Date(record.employmentDateData.hireDate)
      : null,
    terminationDate: record.employmentDateData?.terminationDate
      ? new Date(record.employmentDateData.terminationDate)
      : null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
