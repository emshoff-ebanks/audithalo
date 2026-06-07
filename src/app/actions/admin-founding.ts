"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";

const toggleSchema = z.object({
  userId: z.string().uuid(),
  grant: z.enum(["true", "false"]),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Admin-only action — toggle a user's Founding Supervisor flag.
 *
 * Used after Damon manually approves an application from /founding. The
 * caller passes the user's id and whether to grant (true) or revoke
 * (false). Writes an audit log entry either way so the timeline is intact.
 *
 * Returns 404-equivalent ("Not found") to non-admins to avoid leaking the
 * action's existence.
 */
export async function toggleFoundingSupervisorAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return { ok: false, error: "Not found." };
  }

  const parsed = toggleSchema.safeParse({
    userId: formData.get("userId"),
    grant: formData.get("grant"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, parsed.data.userId),
    columns: { id: true, email: true, isFoundingSupervisor: true },
  });
  if (!target) {
    return { ok: false, error: "User not found." };
  }

  const nextValue = parsed.data.grant === "true";
  if (target.isFoundingSupervisor === nextValue) {
    return { ok: true };
  }

  await db
    .update(schema.users)
    .set({ isFoundingSupervisor: nextValue })
    .where(eq(schema.users.id, target.id));

  // Audit entry — orgId is required by the schema but Founding Supervisor
  // is a user-level state, not org-level. Fall back to the user's first
  // org membership for attribution; if none exists we still log without it.
  const membership = await db.query.orgMemberships.findFirst({
    where: eq(schema.orgMemberships.userId, target.id),
    columns: { orgId: true },
  });

  try {
    await logAuditEvent({
      orgId: membership?.orgId ?? "00000000-0000-0000-0000-000000000000",
      actorUserId: session.user.id,
      action: nextValue
        ? AUDIT_ACTIONS.FOUNDING_SUPERVISOR_GRANTED
        : AUDIT_ACTIONS.FOUNDING_SUPERVISOR_REVOKED,
      resourceType: "user",
      resourceId: target.id,
      details: { email: target.email },
    });
  } catch (err) {
    console.error("[audit-log] founding supervisor toggle failed:", err);
  }

  revalidatePath("/admin/founding-supervisors");
  revalidatePath("/dashboard");
  return { ok: true };
}
