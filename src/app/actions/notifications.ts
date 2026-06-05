"use server";

import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import type {
  NotificationKind,
  NotificationPrefs,
} from "@/lib/db/schema";
import { NOTIFICATION_DEFAULTS } from "@/lib/notifications";

export type NotificationActionResult =
  | { ok: true }
  | { ok: false; error: string };

const KIND_VALUES = [
  "invite_accepted",
  "signature_needed",
  "rule_changed",
  "evidence_sealed",
  "supervisor_rule_not_set",
  "attestation_overdue",
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

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { notificationPrefs: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  const current: NotificationPrefs = user.notificationPrefs ?? {
    email: { ...NOTIFICATION_DEFAULTS.email },
  };
  const merged: NotificationPrefs = {
    email: { ...NOTIFICATION_DEFAULTS.email, ...current.email },
  };
  merged.email[parsed.data.kind] = parsed.data.email;

  await db
    .update(schema.users)
    .set({ notificationPrefs: merged })
    .where(eq(schema.users.id, session.user.id));
  revalidatePath("/dashboard/account");
  return { ok: true };
}
