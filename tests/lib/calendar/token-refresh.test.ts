import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  // Encryption key needed for crypto + token-refresh imports.
  process.env.MS_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.MS_CLIENT_ID = "ms-client-id";
  process.env.MS_CLIENT_SECRET = "ms-client-secret";
  process.env.GOOGLE_CLIENT_ID = "google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
  process.env.APP_URL = "https://app.example.test";
});

const dbUpdateMock = vi.fn();
const dbSetMock = vi.fn((updates: unknown) => {
  void updates;
  return { where: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("@/lib/db", () => ({
  db: {
    update: (...args: unknown[]) => {
      dbUpdateMock(...args);
      return { set: dbSetMock };
    },
  },
  schema: {
    userCalendarIntegrations: {
      id: { name: "id" },
    },
  },
}));

import { encryptToken } from "@/lib/crypto";
import {
  getUsableAccessToken,
  IntegrationRefreshError,
  type IntegrationRow,
} from "@/lib/calendar/token-refresh";

const FETCH_SPY = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  dbUpdateMock.mockClear();
  dbSetMock.mockClear();
  FETCH_SPY.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeRow(overrides: Partial<IntegrationRow> = {}): IntegrationRow {
  const accessTokenPlain = "access-original";
  const refreshTokenPlain = "refresh-original";
  return {
    id: "integration-1",
    userId: "user-1",
    provider: "microsoft",
    accountEmail: "u@example.test",
    accessToken: encryptToken(accessTokenPlain),
    refreshToken: encryptToken(refreshTokenPlain),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1hr ahead
    scopes: ["Calendars.ReadWrite"],
    defaultReminderMinutes: [60, 15],
    syncSupervisionSessions: true,
    isPreferred: false,
    connectedAt: new Date(),
    disconnectedAt: null,
    ...overrides,
  } as IntegrationRow;
}

describe("getUsableAccessToken", () => {
  it("returns the decrypted token without refreshing when it has runway left", async () => {
    const row = makeRow();
    const token = await getUsableAccessToken(row);
    expect(token).toBe("access-original");
    expect(FETCH_SPY).not.toHaveBeenCalled();
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it("refreshes when the token is within the 1-minute skew window", async () => {
    FETCH_SPY.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "access-fresh",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh-rotated",
          scope: "Calendars.ReadWrite OnlineMeetings.ReadWrite",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const row = makeRow({ expiresAt: new Date(Date.now() + 30_000) });
    const token = await getUsableAccessToken(row);

    expect(token).toBe("access-fresh");
    expect(FETCH_SPY).toHaveBeenCalledTimes(1);
    const [url, init] = FETCH_SPY.mock.calls[0];
    expect(String(url)).toContain("login.microsoftonline.com");
    const body = (init?.body as URLSearchParams).toString();
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=refresh-original");
    expect(dbSetMock).toHaveBeenCalledTimes(1);
    const updates = dbSetMock.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    expect(updates.accessToken).toBeDefined();
    expect(updates.refreshToken).toBeDefined();
    expect(updates.scopes).toEqual([
      "Calendars.ReadWrite",
      "OnlineMeetings.ReadWrite",
    ]);
  });

  it("keeps the stored refresh token when Google omits one on refresh", async () => {
    FETCH_SPY.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "google-fresh",
          token_type: "Bearer",
          expires_in: 3600,
          // no refresh_token — typical Google behavior after the first consent
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const row = makeRow({
      provider: "google",
      expiresAt: new Date(Date.now() - 10_000),
    });
    const token = await getUsableAccessToken(row);
    expect(token).toBe("google-fresh");
    const updates = dbSetMock.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    expect(updates.accessToken).toBeDefined();
    expect(updates.refreshToken).toBeUndefined();
  });

  it("throws IntegrationRefreshError if there is no refresh token to use", async () => {
    const row = makeRow({
      refreshToken: null,
      expiresAt: new Date(Date.now() - 10_000),
    });
    await expect(getUsableAccessToken(row)).rejects.toBeInstanceOf(
      IntegrationRefreshError
    );
    expect(FETCH_SPY).not.toHaveBeenCalled();
  });

  it("throws IntegrationRefreshError when the provider returns 4xx", async () => {
    FETCH_SPY.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "invalid_grant" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );
    const row = makeRow({ expiresAt: new Date(Date.now() - 1000) });
    await expect(getUsableAccessToken(row)).rejects.toBeInstanceOf(
      IntegrationRefreshError
    );
  });

  it("refreshes when expiresAt is null (treat as expired)", async () => {
    FETCH_SPY.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "from-null-expiry",
          token_type: "Bearer",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const row = makeRow({ expiresAt: null });
    const token = await getUsableAccessToken(row);
    expect(token).toBe("from-null-expiry");
  });
});
