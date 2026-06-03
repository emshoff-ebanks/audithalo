"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";

type Result = { ok: true } | { ok: false; error: string };

const ALLOWED_SOURCE_ROLES = new Set(["supervisor", "hr_admin", "executive"]);

const updateRoleSchema = z.object({
  targetUserId: z.string().uuid(),
  newRole: z.enum(["supervisor", "hr_admin", "executive"]),
});

export async function updateMemberRoleAction(
  _prev: Result | undefined,
  formData: FormData
): Promise<Result> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = updateRoleSchema.safeParse({
    targetUserId: formData.get("targetUserId"),
    newRole: formData.get("newRole"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (session.user.id === parsed.data.targetUserId) {
    return { ok: false, error: "You can't change your own role." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return { ok: false, error: "No organization." };
  }

  // Only the org creator may manage roles
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, membership.orgId),
  });
  if (!org || org.createdById !== session.user.id) {
    return { ok: false, error: "Only the practice owner can manage team roles." };
  }

  // Confirm the target is a manager in this org (not a supervisee)
  const targetMembership = await db.query.orgMemberships.findFirst({
    where: and(
      eq(schema.orgMemberships.userId, parsed.data.targetUserId),
      eq(schema.orgMemberships.orgId, membership.orgId)
    ),
  });
  if (!targetMembership) {
    return { ok: false, error: "User is not a member of your organization." };
  }
  if (!ALLOWED_SOURCE_ROLES.has(targetMembership.role)) {
    return {
      ok: false,
      error: "Supervisee roles are managed by invitation, not by promotion.",
    };
  }

  // Update BOTH the users.role and the org_memberships.role
  // (in sync for v1; future per-org role tables would need this differently)
  await db
    .update(schema.users)
    .set({ role: parsed.data.newRole })
    .where(eq(schema.users.id, parsed.data.targetUserId));

  await db
    .update(schema.orgMemberships)
    .set({ role: parsed.data.newRole })
    .where(
      and(
        eq(schema.orgMemberships.userId, parsed.data.targetUserId),
        eq(schema.orgMemberships.orgId, membership.orgId)
      )
    );

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
      resourceType: "user",
      resourceId: parsed.data.targetUserId,
      details: {
        priorRole: targetMembership.role,
        newRole: parsed.data.newRole,
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to record role change:", err);
  }

  revalidatePath("/dashboard/team");
  return { ok: true };
}
