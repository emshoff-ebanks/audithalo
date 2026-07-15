"use server";

import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import type { NotificationKind } from "@/lib/db/schema";
import { listUnreadNotifications } from "@/lib/notifications";

export type NotificationActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Used by the bell's 60-second polling loop to refresh the unread list
 * without reloading the page. Best-effort: returns an empty list when the
 * user isn't authenticated or the query throws.
 */
export async function fetchUnreadNotificationsAction(): Promise<
  Array<{
    id: string;
    kind: NotificationKind;
    payload: Record<string, unknown>;
    createdAt: string;
  }>
> {
  const session = await auth();
  if (!session?.user) return [];
  try {
    const rows = await listUnreadNotifications(session.user.id);
    return rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      payload: n.payload as Record<string, unknown>,
      createdAt: n.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error("[actions] fetchUnreadNotificationsAction:", err);
    return [];
  }
}

const KIND_VALUES = [
  "invite_accepted",
  "signature_needed",
  "rule_changed",
  "evidence_sealed",
  "supervisor_rule_not_set",
  "attestation_overdue",
  "trial_ending_soon",
  "session_scheduled",
  "session_canceled",
  "session_rescheduled",
  "session_reminder_1hour",
  "session_reminder_15min",
  "session_no_show",
  "session_sign_reminder",
] as const satisfies readonly NotificationKind[];

const updatePrefsSchema = z.object({
  kind: z.enum(KIND_VALUES),
  email: z.boolean(),
});

const idSchema = z.object({ id: z.string().uuid() });

export async function markNotificationReadAction(
  input: { id: string }
): Promise<NotificationActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.id, parsed.data.id),
        eq(schema.notifications.userId, session.user.id)
      )
    );
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markAllReadAction(): Promise<NotificationActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.userId, session.user.id),
        isNull(schema.notifications.readAt)
      )
    );
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateNotificationPrefsAction(
  input: { kind: NotificationKind; email: boolean }
): Promise<NotificationActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = updatePrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await db
    .update(schema.users)
    .set({
      notificationPrefs: sql`jsonb_set(
        COALESCE(${schema.users.notificationPrefs}, '{"email":{}}'),
        ${sql.raw(`'{email,${parsed.data.kind}}'`)},
        ${parsed.data.email ? sql`'true'::jsonb` : sql`'false'::jsonb`}
      )`,
    })
    .where(eq(schema.users.id, session.user.id));
  revalidatePath("/dashboard/account");
  return { ok: true };
}
