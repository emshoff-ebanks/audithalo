"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { isValidStateCode } from "@/lib/us-states";
import {
  getRule,
  isCustomRuleId,
  listRuleIds,
  parseCustomRuleId,
} from "@/lib/rules";
import { sendRuleChangedEmail } from "@/lib/email";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";
import { capture } from "@/lib/observability/posthog-server";

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

  // Two valid namespaces: canonical YAML ids (matched against listRuleIds)
  // and org-scoped custom rule ids (must belong to *this* org and reference
  // an active row in org_rule_overrides).
  if (isCustomRuleId(parsed.data.ruleId)) {
    const parts = parseCustomRuleId(parsed.data.ruleId);
    if (!parts || parts.orgId !== orgId) {
      return {
        ok: false,
        error: "That custom rule doesn't belong to your organization.",
      };
    }
    const row = await db.query.orgRuleOverrides.findFirst({
      where: and(
        eq(schema.orgRuleOverrides.orgId, orgId),
        eq(schema.orgRuleOverrides.jurisdiction, parts.jurisdiction),
        eq(schema.orgRuleOverrides.licenseCode, parts.licenseCode),
        eq(schema.orgRuleOverrides.version, parts.version),
        eq(schema.orgRuleOverrides.isActive, true)
      ),
    });
    if (!row || row.canonicalRuleId !== null) {
      return {
        ok: false,
        error: `Custom rule "${parsed.data.ruleId}" no longer exists.`,
      };
    }
  } else {
    const validRuleIds = new Set(listRuleIds());
    if (!validRuleIds.has(parsed.data.ruleId)) {
      return { ok: false, error: `Unknown rule "${parsed.data.ruleId}".` };
    }
  }

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

  try {
    await logAuditEvent({
      orgId,
      actorUserId: access.session.user.id,
      action: priorAssignment
        ? AUDIT_ACTIONS.RULE_CHANGED
        : AUDIT_ACTIONS.RULE_ASSIGNED,
      resourceType: "supervisee",
      resourceId: parsed.data.superviseeId,
      details: {
        ruleId: parsed.data.ruleId,
        priorRuleId: priorAssignment?.ruleId ?? null,
        obligationStartedAt: parsed.data.obligationStartedAt,
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to record rule assignment:", err);
  }

  capture("state_rule_selected", access.session.user.id, {
    orgId,
    superviseeId: parsed.data.superviseeId,
    ruleId: parsed.data.ruleId,
    priorRuleId: priorAssignment?.ruleId ?? null,
    isReassignment: !!priorAssignment,
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
  // Also nuke the supervisee's own /dashboard so their dashboard's
  // "Tracking against … " line picks up the new rule immediately.
  // Without this, they keep seeing the old rule name until their JWT
  // happens to refresh or they sign in/out.
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

const logSessionSchema = z.object({
  superviseeId: z.string().uuid(),
  kind: z.enum(["practice", "supervision"]),
  date: z.string(),
  durationHours: z.coerce.number().positive(),
  directContactHours: z.coerce.number().nonnegative().optional(),
  practiceState: z.string().length(2).optional(),
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
    practiceState: (formData.get("practiceState") as string) || undefined,
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
  if (
    parsed.data.practiceState &&
    !isValidStateCode(parsed.data.practiceState)
  ) {
    return { ok: false, error: "Invalid state code." };
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

  // Block supervision sessions if the supervisee's rule requires a
  // pre-registration contract and it hasn't been filed yet. Prevents
  // the "sessions logged before contract" warning from ever appearing.
  if (parsed.data.kind === "supervision") {
    const assignment = await db.query.superviseeRuleAssignments.findFirst({
      where: and(
        eq(schema.superviseeRuleAssignments.superviseeId, parsed.data.superviseeId),
        eq(schema.superviseeRuleAssignments.orgId, orgId)
      ),
    });
    if (assignment && !assignment.supervisionContractFiledAt) {
      const { getRule } = await import("@/lib/rules");
      const [, jur, lic, vRaw] =
        assignment.ruleId.match(/^(.+?)-(.+?)-v(\d+)$/) ?? [];
      if (jur && lic && vRaw) {
        try {
          const rule = getRule(
            jur.toUpperCase(),
            lic.toUpperCase(),
            parseInt(vRaw, 10)
          );
          const needsContract = rule.checks?.some(
            (c: { id: string }) => c.id === "pre_registration_required"
          );
          if (needsContract) {
            return {
              ok: false,
              error:
                "This supervisee's supervision contract hasn't been filed with the state board yet. File the contract first — sessions logged before the contract date won't count toward licensure.",
            };
          }
        } catch {
          // Rule not found — allow the session (defensive)
        }
      }
    }
  }

  let credentials: string[] | null = null;
  if (parsed.data.supervisorCredentials) {
    try {
      const parsed_creds = JSON.parse(parsed.data.supervisorCredentials);
      credentials = Array.isArray(parsed_creds)
        ? parsed_creds.filter(Boolean)
        : null;
    } catch {
      credentials = parsed.data.supervisorCredentials
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    }
  }
  if (credentials && credentials.length === 0) {
    credentials = null;
  }
  if (parsed.data.kind === "supervision" && (!credentials || credentials.length === 0)) {
    return {
      ok: false,
      error:
        "Supervisor credentials are required. Set them in your profile under Settings > Account.",
    };
  }

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
      practiceState: parsed.data.practiceState ?? null,
      sessionType: parsed.data.sessionType ?? null,
      supervisorCredentials: credentials,
      supervisorTrainingHours: supervisorTrainingHoursSnapshot,
      groupAttendees: parsed.data.groupAttendees ?? null,
      loggedById: session.user.id,
    })
    .returning({ id: schema.sessionEvents.id });
  const insertedId = inserted.id;

  try {
    await logAuditEvent({
      orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.SESSION_LOGGED,
      resourceType: "session_event",
      resourceId: insertedId,
      details: {
        superviseeId: parsed.data.superviseeId,
        kind: parsed.data.kind,
        date: parsed.data.date,
        durationHours: parsed.data.durationHours,
        sessionType: parsed.data.sessionType ?? null,
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to record session.logged:", err);
  }

  capture("session_logged", session.user.id, {
    orgId,
    superviseeId: parsed.data.superviseeId,
    sessionEventId: insertedId,
    kind: parsed.data.kind,
    durationHours: parsed.data.durationHours,
    sessionType: parsed.data.sessionType ?? null,
  });

  // Notify supervisee if this is a supervision event (practice events don't
  // need signatures). createNotification writes the bell row and (when the
  // supervisee opts in for signature_needed — default true) sends the email.
  // Failure must never block the action — wrapped in try/catch.
  //
  // Guard: don't ping the supervisee for a session that hasn't happened yet.
  // The scheduling path (Phase 5 group/recurring sessions) creates rows with
  // future dates that the user shouldn't be asked to sign until the meeting
  // is actually over. A scheduled-session reminder fires through
  // session_reminder_1hour/_15min instead.
  const sessionStart = new Date(parsed.data.date);
  const sessionIsInFuture = sessionStart.getTime() > Date.now();
  if (parsed.data.kind === "supervision" && !sessionIsInFuture) {
    try {
      await createNotification({
        userId: parsed.data.superviseeId,
        kind: "signature_needed",
        payload: {
          sessionId: insertedId,
          sessionDate: parsed.data.date,
          sessionType: parsed.data.sessionType ?? "individual",
          durationHours: parsed.data.durationHours,
        },
      });
    } catch (err) {
      console.error("[notifications] signature_needed failed:", err);
    }
  }

  revalidatePath(`/dashboard/roster/${parsed.data.superviseeId}`);

  // Supervision sessions need both parties to sign before they seal. Send
  // the logger straight to /sign/[id] so they can sign immediately instead
  // of scrolling back through the session log. Practice events don't need
  // signing — leave the supervisor on the supervisee page to keep batch-
  // logging fast. Future-dated supervision rows (scheduled ahead) don't get
  // the auto-redirect either — there's nothing to sign yet.
  if (parsed.data.kind === "supervision" && !sessionIsInFuture) {
    redirect(`/sign/${insertedId}`);
  }

  return { ok: true };
}
