import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PaycorApiClient, PaycorApiError } from "@/lib/hris/paycor-api-client";
import type { TokenRefreshCallback } from "@/lib/hris/paycor-api-client";
import type { PaycorConfig } from "@/lib/db/schema";

function makeConfig(overrides: Partial<PaycorConfig> = {}): PaycorConfig {
  return {
    legalEntityId: "12345",
    environment: "sandbox",
    apimSubscriptionKey: "sub-key-abc",
    oauthClientId: "client-id",
    oauthClientSecret: "client-secret",
    oauthAccessToken: "access-token-valid",
    oauthRefreshToken: "refresh-token",
    tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
    connectedAt: "2026-07-01T00:00:00.000Z",
    connectedByUserId: "user-hr-admin",
    ...overrides,
  };
}

const SANDBOX_BASE = "https://apis-sandbox.paycor.com";

function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// fetchEmployees — single page
// ---------------------------------------------------------------------------

describe("fetchEmployees", () => {
  it("returns flattened employees from a single page", async () => {
    const client = new PaycorApiClient(makeConfig());

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hasMoreResults: false,
        continuationToken: null,
        records: [
          {
            id: "emp-001",
            firstName: "Jordan",
            lastName: "Williams",
            email: { emailAddress: "jordan@ri.org" },
            statusData: { status: "Active" },
            positionData: {
              jobTitle: "Clinician",
              manager: { id: "mgr-001" },
            },
            employmentDateData: {
              hireDate: "2024-01-15T00:00:00Z",
              terminationDate: null,
            },
          },
          {
            id: "emp-002",
            firstName: "Sarah",
            lastName: "Chen",
            email: { emailAddress: "sarah@ri.org" },
            statusData: { status: "LeaveWithPay" },
            positionData: { jobTitle: "Supervisor", manager: null },
            employmentDateData: {
              hireDate: "2023-06-01T00:00:00Z",
              terminationDate: null,
            },
          },
        ],
      }),
    );

    const employees = await client.fetchEmployees("12345");

    expect(employees).toHaveLength(2);
    expect(employees[0]).toEqual({
      paycorEmployeeId: "emp-001",
      firstName: "Jordan",
      lastName: "Williams",
      email: "jordan@ri.org",
      status: "Active",
      jobTitle: "Clinician",
      managerId: "mgr-001",
      hireDate: new Date("2024-01-15T00:00:00Z"),
      terminationDate: null,
    });
    expect(employees[1].status).toBe("LeaveWithPay");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/v1/legalentities/12345/employees");
    expect(url).toContain("include=All");
    expect(opts.headers.Authorization).toBe("Bearer access-token-valid");
    expect(opts.headers["Ocp-Apim-Subscription-Key"]).toBe("sub-key-abc");
  });

  it("paginates via continuationToken", async () => {
    const client = new PaycorApiClient(makeConfig());

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          hasMoreResults: true,
          continuationToken: "page-2-token",
          records: [{ id: "emp-001", firstName: "A", lastName: "B" }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          hasMoreResults: false,
          continuationToken: null,
          records: [{ id: "emp-002", firstName: "C", lastName: "D" }],
        }),
      );

    const employees = await client.fetchEmployees("12345");

    expect(employees).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondUrl).toContain("continuationToken=page-2-token");
  });

  it("handles empty records gracefully", async () => {
    const client = new PaycorApiClient(makeConfig());
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ hasMoreResults: false, records: null }),
    );

    const employees = await client.fetchEmployees("12345");
    expect(employees).toEqual([]);
  });

  it("handles missing nested fields with safe defaults", async () => {
    const client = new PaycorApiClient(makeConfig());
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        hasMoreResults: false,
        records: [
          {
            id: "emp-sparse",
            firstName: null,
            lastName: null,
            email: null,
            statusData: null,
            positionData: null,
            employmentDateData: null,
          },
        ],
      }),
    );

    const [emp] = await client.fetchEmployees("12345");
    expect(emp).toEqual({
      paycorEmployeeId: "emp-sparse",
      firstName: "",
      lastName: "",
      email: "",
      status: "Active",
      jobTitle: null,
      managerId: null,
      hireDate: null,
      terminationDate: null,
    });
  });
});

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

describe("token refresh", () => {
  it("refreshes expired token before request", async () => {
    const expiredConfig = makeConfig({
      tokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const onRefresh = vi.fn<Parameters<TokenRefreshCallback>, ReturnType<TokenRefreshCallback>>();
    onRefresh.mockResolvedValue(undefined);
    const client = new PaycorApiClient(expiredConfig, onRefresh);

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ hasMoreResults: false, records: [] }),
      );

    await client.fetchEmployees("12345");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const refreshCall = fetchMock.mock.calls[0];
    expect(refreshCall[0]).toContain(
      "/v1/authenticationsupport/retrieveAccessTokenWithRefreshToken",
    );
    expect(refreshCall[1].method).toBe("POST");
    const body = JSON.parse(refreshCall[1].body);
    expect(body).toEqual({
      refresh_token: "refresh-token",
      client_id: "client-id",
      client_secret: "client-secret",
    });

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onRefresh.mock.calls[0][0].oauthAccessToken).toBe("new-access-token");

    const employeeCallHeaders = fetchMock.mock.calls[1][1].headers;
    expect(employeeCallHeaders.Authorization).toBe("Bearer new-access-token");
  });

  it("refreshes on 401 and retries", async () => {
    const client = new PaycorApiClient(makeConfig());

    fetchMock
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "refreshed-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ hasMoreResults: false, records: [] }),
      );

    const employees = await client.fetchEmployees("12345");
    expect(employees).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry 401 more than once", async () => {
    const client = new PaycorApiClient(makeConfig());

    fetchMock
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "refreshed-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      )
      .mockResolvedValueOnce(new Response("Still unauthorized", { status: 401 }));

    await expect(client.fetchEmployees("12345")).rejects.toThrow(PaycorApiError);
  });

  it("throws when no refresh token is available", async () => {
    const client = new PaycorApiClient(
      makeConfig({ oauthRefreshToken: undefined, oauthAccessToken: undefined }),
    );

    await expect(client.fetchEmployees("12345")).rejects.toThrow(
      "No refresh token available",
    );
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("throws PaycorApiError on 500", async () => {
    const client = new PaycorApiClient(makeConfig());
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ title: "Internal Server Error" }, 500),
    );

    const err = await client.fetchEmployees("12345").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PaycorApiError);
    expect((err as PaycorApiError).message).toMatch(/500/);
    expect((err as PaycorApiError).statusCode).toBe(500);
  });

  it("retries on 429 with Retry-After", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = new PaycorApiClient(makeConfig());

    fetchMock
      .mockResolvedValueOnce(
        new Response("Rate limited", {
          status: 429,
          headers: { "Retry-After": "1" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ hasMoreResults: false, records: [] }),
      );

    const promise = client.fetchEmployees("12345");
    await vi.advanceTimersByTimeAsync(1100);
    const employees = await promise;

    expect(employees).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// healthCheck
// ---------------------------------------------------------------------------

describe("healthCheck", () => {
  it("returns ok: true on 200", async () => {
    const client = new PaycorApiClient(makeConfig());
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    const result = await client.healthCheck();
    expect(result).toEqual({ ok: true });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${SANDBOX_BASE}/api/Health/ping`);
  });

  it("returns ok: false with error on failure", async () => {
    const client = new PaycorApiClient(makeConfig());
    fetchMock.mockResolvedValueOnce(
      new Response("Service Unavailable", { status: 503 }),
    );

    const result = await client.healthCheck();
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// fetchEmployeeStatus
// ---------------------------------------------------------------------------

describe("fetchEmployeeStatus", () => {
  it("returns status for a single employee", async () => {
    const client = new PaycorApiClient(makeConfig());
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "emp-001",
        statusData: {
          status: "LeaveWithPay",
          leaveStartDate: "2026-06-01T00:00:00Z",
          leaveReason: "FMLA",
        },
      }),
    );

    const status = await client.fetchEmployeeStatus("emp-001");
    expect(status).toEqual({
      employeeId: "emp-001",
      status: "LeaveWithPay",
      leaveStartDate: new Date("2026-06-01T00:00:00Z"),
      leaveReason: "FMLA",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/v1/employees/emp-001");
    expect(url).toContain("include=Status");
  });
});

// ---------------------------------------------------------------------------
// Base URL selection
// ---------------------------------------------------------------------------

describe("base URL", () => {
  it("uses sandbox URL for sandbox environment", async () => {
    const client = new PaycorApiClient(makeConfig({ environment: "sandbox" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ hasMoreResults: false, records: [] }));

    await client.fetchEmployees("12345");
    expect(fetchMock.mock.calls[0][0]).toContain("apis-sandbox.paycor.com");
  });

  it("uses production URL for production environment", async () => {
    const client = new PaycorApiClient(makeConfig({ environment: "production" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ hasMoreResults: false, records: [] }));

    await client.fetchEmployees("12345");
    expect(fetchMock.mock.calls[0][0]).toContain("apis.paycor.com");
    expect(fetchMock.mock.calls[0][0]).not.toContain("sandbox");
  });
});
