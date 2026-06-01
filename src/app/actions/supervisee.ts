"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { listRuleIds } from "@/lib/rules";

async function requireOrgAccess(superviseeId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  const myMembership = await db.query.orgMemberships.findFirst({
    where: eq(schema.orgMemberships.userId, session.user.id),
  });
  if (!myMembership) throw new Error("No organization");

  // Supervisees can only act on themselves; managers can act on anyone in the org.
  if (!isManagerRole(myMembership.role) && session.user.id !== superviseeId) {
    throw new Error("Forbidden");
  }

  const targetMembership = await db.query.orgMemberships.findFirst({
    where: and(
      eq(schema.orgMemberships.userId, superviseeId),
      eq(schema.orgMemberships.orgId, myMembership.orgId)
    ),
  });
  if (!targetMembership) throw new Error("Not in your roster");

  return { session, orgId: myMembership.orgId, viewerRole: myMembership.role };
}

const assignRuleSchema = z.object({
  superviseeId: z.string().uuid(),
  ruleId: z.string(),
  obligationStartedAt: z.string(),
  supervisionContractFiledAt: z.string().optional(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function assignRuleAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = assignRuleSchema.safeParse({
    superviseeId: formData.get("superviseeId"),
    ruleId: formData.get("ruleId"),
    obligationStartedAt: formData.get("obligationStartedAt"),
    supervisionContractFiledAt: formData.get("supervisionContractFiledAt") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const validRuleIds = new Set(listRuleIds());
  if (!validRuleIds.has(parsed.data.ruleId)) {
    return { ok: false, error: `Unknown rule "${parsed.data.ruleId}".` };
  }

  let access;
  try {
    access = await requireOrgAccess(parsed.data.superviseeId);
  } catch {
    return { ok: false, error: "You can't manage this supervisee." };
  }
  if (!isManagerRole(access.viewerRole)) {
    return { ok: false, error: "Only supervisors can assign rules." };
  }
  const { orgId } = access;

  // Upsert pattern: delete prior assignment for this supervisee+org+rule (rare in v1), insert fresh
  await db
    .delete(schema.superviseeRuleAssignments)
    .where(
      and(
        eq(schema.superviseeRuleAssignments.superviseeId, parsed.data.superviseeId),
        eq(schema.superviseeRuleAssignments.orgId, orgId)
      )
    );
  await db.insert(schema.superviseeRuleAssignments).values({
    superviseeId: parsed.data.superviseeId,
    orgId,
    ruleId: parsed.data.ruleId,
    obligationStartedAt: new Date(parsed.data.obligationStartedAt),
    supervisionContractFiledAt: parsed.data.supervisionContractFiledAt
      ? new Date(parsed.data.supervisionContractFiledAt)
      : null,
  });

  revalidatePath(`/dashboard/roster/${parsed.data.superviseeId}`);
  return { ok: true };
}

const logSessionSchema = z.object({
  superviseeId: z.string().uuid(),
  kind: z.enum(["practice", "supervision"]),
  date: z.string(),
  durationHours: z.coerce.number().positive(),
  sessionType: z.enum(["individual", "triadic", "group"]).optional(),
  supervisorCredentials: z.string().optional(),
  groupAttendees: z.coerce.number().int().positive().optional(),
});

export async function logSessionAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const parsed = logSessionSchema.safeParse({
    superviseeId: formData.get("superviseeId"),
    kind: formData.get("kind"),
    date: formData.get("date"),
    durationHours: formData.get("durationHours"),
    sessionType: formData.get("sessionType") || undefined,
    supervisorCredentials: formData.get("supervisorCredentials") || undefined,
    groupAttendees: formData.get("groupAttendees") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (parsed.data.kind === "supervision" && !parsed.data.sessionType) {
    return { ok: false, error: "Supervision sessions require a session type." };
  }

  let access;
  try {
    access = await requireOrgAccess(parsed.data.superviseeId);
  } catch {
    return { ok: false, error: "You can't log sessions for this supervisee." };
  }
  // Supervisees can only log their own practice sessions; supervision attestation requires a supervisor.
  if (
    !isManagerRole(access.viewerRole) &&
    parsed.data.kind === "supervision"
  ) {
    return {
      ok: false,
      error: "Supervision sessions must be logged by your supervisor.",
    };
  }
  const { session, orgId } = access;

  const credentials = parsed.data.supervisorCredentials
    ? parsed.data.supervisorCredentials
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : null;

  await db.insert(schema.sessionEvents).values({
    superviseeId: parsed.data.superviseeId,
    orgId,
    kind: parsed.data.kind,
    date: new Date(parsed.data.date),
    durationHours: parsed.data.durationHours,
    sessionType: parsed.data.sessionType ?? null,
    supervisorCredentials: credentials,
    groupAttendees: parsed.data.groupAttendees ?? null,
    loggedById: session.user.id,
  });

  revalidatePath(`/dashboard/roster/${parsed.data.superviseeId}`);
  return { ok: true };
}
