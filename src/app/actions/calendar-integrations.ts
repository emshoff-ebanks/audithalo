"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import type { CalendarProvider } from "@/lib/calendar/oauth-config";

type ActionResult = { ok: true } | { ok: false; error: string };

const VALID_PROVIDERS: CalendarProvider[] = ["microsoft", "google"];

function assertProvider(p: string): CalendarProvider {
  if (!VALID_PROVIDERS.includes(p as CalendarProvider)) {
    throw new Error(`Unknown calendar provider: ${p}`);
  }
  return p as CalendarProvider;
}

/**
 * Soft-disconnect the user's active integration for a provider. Tokens
 * stay encrypted in the row for the audit window — we just stop using
 * the row. Reconnect creates a fresh row via the OAuth callback.
 */
export async function disconnectCalendarIntegrationAction(
  rawProvider: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  let provider: CalendarProvider;
  try {
    provider = assertProvider(rawProvider);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  await db
    .update(schema.userCalendarIntegrations)
    .set({ disconnectedAt: new Date(), isPreferred: false })
    .where(
      and(
        eq(schema.userCalendarIntegrations.userId, session.user.id),
        eq(schema.userCalendarIntegrations.provider, provider),
        isNull(schema.userCalendarIntegrations.disconnectedAt)
      )
    );

  revalidatePath("/dashboard/account");
  return { ok: true };
}

/**
 * Mark one provider as the user's per-session default. Clears the flag
 * on every other connected provider for the user. Per locked decision
 * #12 in 08-scheduling-and-calendar.md: remember per-user, don't prompt
 * every time.
 */
export async function setPreferredCalendarIntegrationAction(
  rawProvider: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  let provider: CalendarProvider;
  try {
    provider = assertProvider(rawProvider);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  await db.transaction(async (tx) => {
    // Drop the flag on every active row for this user.
    await tx
      .update(schema.userCalendarIntegrations)
      .set({ isPreferred: false })
      .where(
        and(
          eq(schema.userCalendarIntegrations.userId, session.user.id),
          isNull(schema.userCalendarIntegrations.disconnectedAt)
        )
      );
    // Set it on the chosen provider's active row, if one exists.
    await tx
      .update(schema.userCalendarIntegrations)
      .set({ isPreferred: true })
      .where(
        and(
          eq(schema.userCalendarIntegrations.userId, session.user.id),
          eq(schema.userCalendarIntegrations.provider, provider),
          isNull(schema.userCalendarIntegrations.disconnectedAt)
        )
      );
  });

  revalidatePath("/dashboard/account");
  return { ok: true };
}
