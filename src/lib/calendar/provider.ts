/**
 * High-level entry point: load a usable calendar provider client for a
 * given user. Picks the user's preferred integration (or the only one
 * connected, or null if none).
 *
 * The returned client is provider-agnostic — the scheduler doesn't have
 * to know whether it's Microsoft or Google.
 *
 * Token refresh is handled transparently: if the stored access token is
 * within the skew window of expiring, we refresh + persist before
 * handing the client back.
 */
import { and, eq, isNull, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createMicrosoftProvider } from "./providers/microsoft";
import { createGoogleProvider } from "./providers/google";
import { getUsableAccessToken } from "./token-refresh";
import type { CalendarProvider } from "./oauth-config";
import type { CalendarProviderClient } from "./types";

export type ResolvedProvider = {
  client: CalendarProviderClient;
  integrationId: string;
  accountEmail: string | null;
};

/**
 * Return a ready-to-use provider client for the user, or null if they
 * have no connected integration. When multiple are connected, picks the
 * one flagged preferred; falls back to most-recent connection.
 */
export async function getProviderForUser(
  userId: string
): Promise<ResolvedProvider | null> {
  const rows = await db
    .select()
    .from(schema.userCalendarIntegrations)
    .where(
      and(
        eq(schema.userCalendarIntegrations.userId, userId),
        isNull(schema.userCalendarIntegrations.disconnectedAt)
      )
    )
    .orderBy(
      desc(schema.userCalendarIntegrations.isPreferred),
      desc(schema.userCalendarIntegrations.connectedAt)
    );

  const row = rows[0];
  if (!row) return null;

  const accessToken = await getUsableAccessToken(row);
  const client = buildClient(
    row.provider as CalendarProvider,
    accessToken,
    row.accountEmail
  );
  return {
    client,
    integrationId: row.id,
    accountEmail: row.accountEmail,
  };
}

/**
 * Load a specific provider for the user, ignoring the preferred flag.
 * Used when the scheduler offers a per-session override ("Change
 * provider" link).
 */
export async function getNamedProviderForUser(
  userId: string,
  provider: CalendarProvider
): Promise<ResolvedProvider | null> {
  const row = await db.query.userCalendarIntegrations.findFirst({
    where: and(
      eq(schema.userCalendarIntegrations.userId, userId),
      eq(schema.userCalendarIntegrations.provider, provider),
      isNull(schema.userCalendarIntegrations.disconnectedAt)
    ),
  });
  if (!row) return null;

  const accessToken = await getUsableAccessToken(row);
  const client = buildClient(provider, accessToken, row.accountEmail);
  return {
    client,
    integrationId: row.id,
    accountEmail: row.accountEmail,
  };
}

function buildClient(
  provider: CalendarProvider,
  accessToken: string,
  accountEmail: string | null
): CalendarProviderClient {
  switch (provider) {
    case "microsoft":
      return createMicrosoftProvider(accessToken, accountEmail);
    case "google":
      return createGoogleProvider(accessToken, accountEmail);
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported provider: ${_exhaustive as string}`);
    }
  }
}
