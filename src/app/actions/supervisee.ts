"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { getRule, listRuleIds } from "@/lib/rules";
import {
  sendRuleChangedEmail,
  sendSupervisionLoggedEmail,
} from "@/lib/email";

/**
 * Resolves a stored rule ID (e.g. "nc-lcmhca-v1") into a human-friendly label
 * suitable for email subjects ("NC LCMHCA v1"). Returns null if the ID doesn't
 * parse or no matching rule is in the registry — caller should fall back to
 * the raw ID rather than blocking the email.
 */
function ruleLabel(ruleId: string): string | null {
  const [, jur, lic, vRaw] = ruleId.match(/^(.+?)-(.+?)-v(\d+)$/) ?? [];
  if (!jur || !lic || !vRaw) return null;
  try {
    const rule = getRule(jur.toUpperCase(), lic.toUpperCase(), parseInt(vRaw, 10));
    return `${rule.jurisdiction} ${rule.license_code} v${rule.version}`;
  } catch {
    return null;
  }
}

async function requireOrgAccess(superviseeId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  const myMembership = await getCurrentMembership(session.user.id);
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
  if (!canSupervise(access.viewerRole)) {
    return { ok: false, error: "Only supervisors can assign rules." };
  }
  const { orgId } = access;

  // Upsert pattern: delete prior assignment for this supervisee+org+rule (rare in v1), insert fresh.
  // Fetch the prior assignment FIRST so we know whether to send a "rule changed" email.
  const priorAssignment = await db.query.superviseeRuleAssignments.findFirst({
    where: and(
      eq(schema.superviseeRuleAssignments.superviseeId, parsed.data.superviseeId),
      eq(schema.superviseeRuleAssignments.orgId, orgId)
    ),
  });

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

  // Notify the supervisee that their rule changed, but ONLY when:
  //   (a) there was a prior assignment (first-time assignment uses a different flow)
  //   (b) the rule ID actually changed (no-op reassignment shouldn't email)
  // Email failure must NEVER block the action — wrapped in try/catch.
  if (
    priorAssignment &&
    priorAssignment.ruleId !== parsed.data.ruleId
  ) {
    try {
      const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";
      const [supervisee, supervisor] = await Promise.all([
        db.query.users.findFirst({
          where: eq(schema.users.id, parsed.data.superviseeId),
        }),
        db.query.users.findFirst({
          where: eq(schema.users.id, access.session.user.id),
        }),
      ]);
      if (supervisee?.email && supervisor) {
        const oldLabel =
          ruleLabel(priorAssignment.ruleId) ?? priorAssignment.ruleId;
        const newLabel =
          ruleLabel(parsed.data.ruleId) ?? parsed.data.ruleId;
        await sendRuleChangedEmail({
          to: supervisee.email,
          superviseeName: supervisee.name ?? supervisee.email,
          supervisorName: supervisor.name ?? supervisor.email,
          oldRuleLabel: oldLabel,
          newRuleLabel: newLabel,
          dashboardUrl: `${APP_URL}/dashboard`,
        });
      }
    } catch (err) {
      console.error("[email] rule-changed notification failed:", err);
    }
  }

  revalidatePath(`/dashboard/roster/${parsed.data.superviseeId}`);
  return { ok: true };
}

const logSessionSchema = z.object({
  superviseeId: z.string().uuid(),
  kind: z.enum(["practice", "supervision"]),
  date: z.string(),
  durationHours: z.coerce.number().positive(),
  directContactHours: z.coerce.number().nonnegative().optional(),
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
    directContactHours: formData.get("directContactHours") || undefined,
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
    !canSupervise(access.viewerRole) &&
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

  // Snapshot the supervisor's verified training hours at the moment of logging.
  // Only meaningful for supervision sessions logged by a supervisor — for
  // practice sessions or supervisee-self-logged events, stays null.
  let supervisorTrainingHoursSnapshot: number | null = null;
  if (
    parsed.data.kind === "supervision" &&
    canSupervise(access.viewerRole)
  ) {
    const supervisor = await db.query.users.findFirst({
      where: eq(schema.users.id, session.user.id),
    });
    supervisorTrainingHoursSnapshot =
      supervisor?.supervisorTrainingHours ?? null;
  }

  const [inserted] = await db
    .insert(schema.sessionEvents)
    .values({
      superviseeId: parsed.data.superviseeId,
      orgId,
      kind: parsed.data.kind,
      date: new Date(parsed.data.date),
      durationHours: parsed.data.durationHours,
      directContactHours: parsed.data.directContactHours ?? null,
      sessionType: parsed.data.sessionType ?? null,
      supervisorCredentials: credentials,
      supervisorTrainingHours: supervisorTrainingHoursSnapshot,
      groupAttendees: parsed.data.groupAttendees ?? null,
      loggedById: session.user.id,
    })
    .returning({ id: schema.sessionEvents.id });
  const insertedId = inserted.id;

  // Notify supervisee if this is a supervision event (practice events don't need signatures).
  // Email failure must NEVER block the underlying action — wrapped in try/catch.
  if (parsed.data.kind === "supervision") {
    try {
      const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";
      const [supervisee, supervisor] = await Promise.all([
        db.query.users.findFirst({
          where: eq(schema.users.id, parsed.data.superviseeId),
        }),
        db.query.users.findFirst({
          where: eq(schema.users.id, session.user.id),
        }),
      ]);
      if (supervisee?.email && supervisor) {
        await sendSupervisionLoggedEmail({
          to: supervisee.email,
          supervisorName: supervisor.name ?? supervisor.email,
          sessionDate: parsed.data.date,
          sessionType: parsed.data.sessionType ?? "individual",
          durationHours: parsed.data.durationHours,
          signUrl: `${APP_URL}/sign/${insertedId}`,
        });
      }
    } catch (err) {
      console.error("[email] supervision-logged notification failed:", err);
    }
  }

  revalidatePath(`/dashboard/roster/${parsed.data.superviseeId}`);
  return { ok: true };
}
