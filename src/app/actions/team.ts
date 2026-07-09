"use server";

import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  canManageOrg,
  canSupervise,
  getCurrentMembership,
  isHrAdmin,
} from "@/lib/authz";
import { db, schema } from "@/lib/db";
import {
  generateInvitationToken,
  hashToken,
  invitationExpiresAt,
} from "@/lib/invitations";
import { sendEmail } from "@/lib/email";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { verifyTotpCode, findBackupCodeMatch } from "@/lib/totp";
import { capture } from "@/lib/observability/posthog-server";

const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";
const MAX_EXECUTIVE_SEATS = 5;

export type TeamActionResult = { ok: true } | { ok: false; error: string };

// ───────────────────────────────────────────────────────────────────────────
// TOTP gate for sensitive HR Admin actions
//
// Per docs/strategy/04-enterprise-rbac.md: "2FA required for sensitive HR
// Admin actions only (invite HR Admin, export audit log, deactivate user)."
//
// Returns ok=true when the caller submitted a valid TOTP code (or backup
// code) for the signed-in HR Admin. Returns ok=false with a user-facing
// error string otherwise. The caller short-circuits on a non-ok result.
// ───────────────────────────────────────────────────────────────────────────
async function verifySensitiveActionTotp(
  userId: string,
  code: string | undefined
): Promise<TeamActionResult> {
  if (!code) {
    return {
      ok: false,
      error: "Enter your 2FA code from your authenticator app to confirm.",
    };
  }
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: {
      totpEnabledAt: true,
      totpSecret: true,
      totpBackupCodes: true,
    },
  });
  if (!user || !user.totpEnabledAt || !user.totpSecret) {
    return {
      ok: false,
      error:
        "This action requires 2FA. Enable it at /dashboard/account#2fa before continuing.",
    };
  }
  if (verifyTotpCode(code, user.totpSecret)) return { ok: true };
  // Fall back to backup-code consumption — same pattern as the login flow.
  const codes = user.totpBackupCodes ?? [];
  const backupIdx = findBackupCodeMatch(code, codes);
  if (backupIdx === -1) {
    return { ok: false, error: "Invalid 2FA code." };
  }
  const remaining = [...codes];
  remaining.splice(backupIdx, 1);
  await db
    .update(schema.users)
    .set({ totpBackupCodes: remaining })
    .where(eq(schema.users.id, userId));
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────────────
// Invite Supervisor (HR Admin only)
// ───────────────────────────────────────────────────────────────────────────

const inviteSupervisorSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  name: z.string().optional(),
});

export async function inviteSupervisorAction(
  _prev: TeamActionResult | undefined,
  formData: FormData
): Promise<TeamActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageOrg(membership.role)) {
    return { ok: false, error: "Only HR Admins can invite supervisors." };
  }

  const parsed = inviteSupervisorSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const inviteEmail = parsed.data.email.toLowerCase();

  // Block if the email is already in this org as any role.
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.email, inviteEmail),
    columns: { id: true },
  });
  if (existingUser) {
    const dup = await db.query.orgMemberships.findFirst({
      where: and(
        eq(schema.orgMemberships.userId, existingUser.id),
        eq(schema.orgMemberships.orgId, membership.orgId)
      ),
    });
    if (dup) {
      return { ok: false, error: "That person is already on your team." };
    }
  }

  // Re-issue an existing pending supervisor invitation if there is one.
  const openInvite = await db.query.invitations.findFirst({
    where: and(
      eq(schema.invitations.orgId, membership.orgId),
      eq(schema.invitations.email, inviteEmail),
      isNull(schema.invitations.acceptedAt)
    ),
  });
  const token = generateInvitationToken();
  if (openInvite) {
    await db
      .update(schema.invitations)
      .set({
        tokenHash: hashToken(token),
        expiresAt: invitationExpiresAt(),
        invitedById: session.user.id,
        name: parsed.data.name ?? openInvite.name,
        role: "supervisor",
      })
      .where(eq(schema.invitations.id, openInvite.id));
  } else {
    await db.insert(schema.invitations).values({
      orgId: membership.orgId,
      email: inviteEmail,
      name: parsed.data.name ?? null,
      role: "supervisor",
      tokenHash: hashToken(token),
      invitedById: session.user.id,
      expiresAt: invitationExpiresAt(),
    });
  }

  await sendInviteEmail({
    to: inviteEmail,
    name: parsed.data.name ?? null,
    token,
    roleLabel: "supervisor",
    inviterName: session.user.name ?? session.user.email,
  });

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.INVITATION_SENT,
      resourceType: "invitation",
      resourceId: inviteEmail,
      details: { email: inviteEmail, role: "supervisor" },
    });
  } catch (err) {
    console.error("[team] supervisor invite audit failed:", err);
  }

  revalidatePath("/dashboard/team");
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────────────
// Invite HR Admin (HR Admin only, requires TOTP)
// ───────────────────────────────────────────────────────────────────────────

const inviteHrAdminSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  name: z.string().optional(),
  totpCode: z.string().min(6, "Enter your 2FA code."),
});

export async function inviteHrAdminAction(
  _prev: TeamActionResult | undefined,
  formData: FormData
): Promise<TeamActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageOrg(membership.role)) {
    return { ok: false, error: "Only HR Admins can invite other HR Admins." };
  }

  const parsed = inviteHrAdminSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
    totpCode: formData.get("totpCode") || "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const totpResult = await verifySensitiveActionTotp(
    session.user.id,
    parsed.data.totpCode
  );
  if (!totpResult.ok) return totpResult;

  const inviteEmail = parsed.data.email.toLowerCase();

  // No dup check for HR Admin — could be a co-promotion of an existing
  // member. If they're already an HR Admin, the accept flow will no-op
  // gracefully via the membership conflict.

  const token = generateInvitationToken();
  await db.insert(schema.invitations).values({
    orgId: membership.orgId,
    email: inviteEmail,
    name: parsed.data.name ?? null,
    role: "hr_admin",
    tokenHash: hashToken(token),
    invitedById: session.user.id,
    expiresAt: invitationExpiresAt(),
  });

  await sendInviteEmail({
    to: inviteEmail,
    name: parsed.data.name ?? null,
    token,
    roleLabel: "HR Admin",
    inviterName: session.user.name ?? session.user.email,
  });

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.INVITATION_SENT,
      resourceType: "invitation",
      resourceId: inviteEmail,
      details: { email: inviteEmail, role: "hr_admin", sensitive: true },
    });
  } catch (err) {
    console.error("[team] hr_admin invite audit failed:", err);
  }

  revalidatePath("/dashboard/team");
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────────────
// Invite Executive (HR Admin only, capped at 5 active per org)
// ───────────────────────────────────────────────────────────────────────────

const inviteExecutiveSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  name: z.string().optional(),
});

export async function inviteExecutiveAction(
  _prev: TeamActionResult | undefined,
  formData: FormData
): Promise<TeamActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageOrg(membership.role)) {
    return { ok: false, error: "Only HR Admins can invite executives." };
  }

  // Executive seat cap — count active (non-deactivated) executive memberships
  // plus open executive invitations.
  const [activeExecs, openExecInvites] = await Promise.all([
    db.query.orgMemberships.findMany({
      where: and(
        eq(schema.orgMemberships.orgId, membership.orgId),
        eq(schema.orgMemberships.role, "executive"),
        isNull(schema.orgMemberships.deactivatedAt)
      ),
    }),
    db.query.invitations.findMany({
      where: and(
        eq(schema.invitations.orgId, membership.orgId),
        eq(schema.invitations.role, "executive"),
        isNull(schema.invitations.acceptedAt)
      ),
    }),
  ]);
  const used = activeExecs.length + openExecInvites.length;
  if (used >= MAX_EXECUTIVE_SEATS) {
    return {
      ok: false,
      error: `Executive seat cap of ${MAX_EXECUTIVE_SEATS} reached. Deactivate an existing executive first.`,
    };
  }

  const parsed = inviteExecutiveSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const inviteEmail = parsed.data.email.toLowerCase();

  const token = generateInvitationToken();
  await db.insert(schema.invitations).values({
    orgId: membership.orgId,
    email: inviteEmail,
    name: parsed.data.name ?? null,
    role: "executive",
    tokenHash: hashToken(token),
    invitedById: session.user.id,
    expiresAt: invitationExpiresAt(),
  });

  await sendInviteEmail({
    to: inviteEmail,
    name: parsed.data.name ?? null,
    token,
    roleLabel: "Executive",
    inviterName: session.user.name ?? session.user.email,
  });

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.INVITATION_SENT,
      resourceType: "invitation",
      resourceId: inviteEmail,
      details: { email: inviteEmail, role: "executive" },
    });
  } catch (err) {
    console.error("[team] executive invite audit failed:", err);
  }

  revalidatePath("/dashboard/team");
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────────────
// Deactivate a team member (HR Admin only, requires TOTP)
// ───────────────────────────────────────────────────────────────────────────

const deactivateMemberSchema = z.object({
  membershipId: z.string().uuid(),
  totpCode: z.string().min(6, "Enter your 2FA code."),
});

export async function deactivateMemberAction(
  _prev: TeamActionResult | undefined,
  formData: FormData
): Promise<TeamActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };
  const callerMembership = await getCurrentMembership(session.user.id);
  if (!callerMembership || !canManageOrg(callerMembership.role)) {
    return { ok: false, error: "Only HR Admins can deactivate members." };
  }

  const parsed = deactivateMemberSchema.safeParse({
    membershipId: formData.get("membershipId"),
    totpCode: formData.get("totpCode") || "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const totpResult = await verifySensitiveActionTotp(
    session.user.id,
    parsed.data.totpCode
  );
  if (!totpResult.ok) return totpResult;

  const target = await db.query.orgMemberships.findFirst({
    where: eq(schema.orgMemberships.id, parsed.data.membershipId),
  });
  if (!target) return { ok: false, error: "Member not found." };
  if (target.orgId !== callerMembership.orgId) {
    return { ok: false, error: "Member is not in your org." };
  }
  if (target.userId === session.user.id) {
    return { ok: false, error: "You cannot deactivate yourself." };
  }
  if (target.deactivatedAt) {
    return { ok: false, error: "Already deactivated." };
  }

  // Guard: org must always have ≥1 active HR Admin.
  if (target.role === "hr_admin") {
    const otherActiveHrAdmins = await db.query.orgMemberships.findMany({
      where: and(
        eq(schema.orgMemberships.orgId, callerMembership.orgId),
        eq(schema.orgMemberships.role, "hr_admin"),
        isNull(schema.orgMemberships.deactivatedAt)
      ),
    });
    if (otherActiveHrAdmins.filter((m) => m.id !== target.id).length === 0) {
      return {
        ok: false,
        error:
          "This is the last active HR Admin. Promote another HR Admin first.",
      };
    }
  }

  // Guard: supervisor with active assignments must reassign first.
  if (target.role === "supervisor") {
    const activeAssignments = await db.query.supervisorAssignments.findMany({
      where: and(
        eq(schema.supervisorAssignments.supervisorId, target.userId),
        eq(schema.supervisorAssignments.orgId, target.orgId),
        isNull(schema.supervisorAssignments.endedAt)
      ),
    });
    if (activeAssignments.length > 0) {
      return {
        ok: false,
        error: `Supervisor still has ${activeAssignments.length} active supervisee${activeAssignments.length === 1 ? "" : "s"}. Reassign them first.`,
      };
    }
  }

  await db
    .update(schema.orgMemberships)
    .set({
      deactivatedAt: new Date(),
      deactivatedByUserId: session.user.id,
    })
    .where(eq(schema.orgMemberships.id, target.id));

  // Bump sessionsValidFrom on the target so any active session is rejected.
  await db
    .update(schema.users)
    .set({ sessionsValidFrom: new Date() })
    .where(eq(schema.users.id, target.userId));

  try {
    await logAuditEvent({
      orgId: callerMembership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
      resourceType: "user",
      resourceId: target.userId,
      details: {
        change: "deactivated",
        previousRole: target.role,
        sensitive: true,
      },
    });
  } catch (err) {
    console.error("[team] deactivate audit failed:", err);
  }

  revalidatePath("/dashboard/team");
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────────────
// Reassign supervisor on a supervisee (HR Admin only)
// ───────────────────────────────────────────────────────────────────────────

const reassignSchema = z.object({
  superviseeId: z.string().uuid(),
  newSupervisorId: z.string().uuid(),
});

export async function reassignSupervisorAction(
  _prev: TeamActionResult | undefined,
  formData: FormData
): Promise<TeamActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };
  const callerMembership = await getCurrentMembership(session.user.id);
  if (!callerMembership || !canManageOrg(callerMembership.role)) {
    return { ok: false, error: "Only HR Admins can reassign supervisors." };
  }

  const parsed = reassignSchema.safeParse({
    superviseeId: formData.get("superviseeId"),
    newSupervisorId: formData.get("newSupervisorId"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  // Verify both users belong to this org.
  const [superviseeMembership, newSupervisorMembership] = await Promise.all([
    db.query.orgMemberships.findFirst({
      where: and(
        eq(schema.orgMemberships.userId, parsed.data.superviseeId),
        eq(schema.orgMemberships.orgId, callerMembership.orgId),
        eq(schema.orgMemberships.role, "supervisee"),
        isNull(schema.orgMemberships.deactivatedAt)
      ),
    }),
    db.query.orgMemberships.findFirst({
      where: and(
        eq(schema.orgMemberships.userId, parsed.data.newSupervisorId),
        eq(schema.orgMemberships.orgId, callerMembership.orgId),
        eq(schema.orgMemberships.role, "supervisor"),
        isNull(schema.orgMemberships.deactivatedAt)
      ),
    }),
  ]);
  if (!superviseeMembership) {
    return { ok: false, error: "Supervisee not in this org." };
  }
  if (!newSupervisorMembership) {
    return { ok: false, error: "New supervisor not in this org." };
  }

  // Find the current active primary assignment to close.
  const currentAssignment = await db.query.supervisorAssignments.findFirst({
    where: and(
      eq(schema.supervisorAssignments.superviseeId, parsed.data.superviseeId),
      eq(schema.supervisorAssignments.orgId, callerMembership.orgId),
      eq(schema.supervisorAssignments.isPrimary, true),
      isNull(schema.supervisorAssignments.endedAt)
    ),
  });

  const previousSupervisorId = currentAssignment?.supervisorId;

  // Idempotent — if the supervisee is already on this supervisor, no-op.
  if (previousSupervisorId === parsed.data.newSupervisorId) {
    return { ok: true };
  }

  // Close the existing assignment.
  if (currentAssignment) {
    await db
      .update(schema.supervisorAssignments)
      .set({ endedAt: new Date() })
      .where(eq(schema.supervisorAssignments.id, currentAssignment.id));
  }

  // Open the new assignment.
  await db.insert(schema.supervisorAssignments).values({
    orgId: callerMembership.orgId,
    supervisorId: parsed.data.newSupervisorId,
    superviseeId: parsed.data.superviseeId,
    isPrimary: true,
    transferredFromSupervisorId: previousSupervisorId ?? null,
  });

  try {
    await logAuditEvent({
      orgId: callerMembership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.RULE_CHANGED, // closest existing action; new one would need a migration
      resourceType: "supervisor_assignment",
      resourceId: parsed.data.superviseeId,
      details: {
        previousSupervisorId: previousSupervisorId ?? null,
        newSupervisorId: parsed.data.newSupervisorId,
      },
    });
  } catch (err) {
    console.error("[team] reassign audit failed:", err);
  }

  capture("supervisee_added", session.user.id, {
    orgId: callerMembership.orgId,
    superviseeId: parsed.data.superviseeId,
    action: "reassignment",
  });

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/roster");
  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────────────
// Shared invite-email helper for the role-tagged team invitations
// ───────────────────────────────────────────────────────────────────────────

async function sendInviteEmail(opts: {
  to: string;
  name: string | null;
  token: string;
  roleLabel: string;
  inviterName: string;
}) {
  const link = `${APP_URL}/accept-invite/${opts.token}`;
  const greeting = opts.name ? `Hi ${opts.name},` : "Hi,";
  await sendEmail({
    to: opts.to,
    subject: `${opts.inviterName} invited you to AuditHalo as ${opts.roleLabel}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#08111F; max-width: 560px;">
        <h2 style="font-size: 24px; margin: 0 0 16px;">You&apos;re invited.</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          ${greeting} <strong>${opts.inviterName}</strong> invited you to join their
          AuditHalo organization as <strong>${opts.roleLabel}</strong>.
        </p>
        <p style="margin: 32px 0;">
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background:#071A3D; color:#FBFAF6; text-decoration:none; font-weight:600; border-radius: 4px;">
            Accept invitation
          </a>
        </p>
        <p style="font-size: 13px; color: #5f6470;">
          Or copy this link: ${link}<br />
          This invitation expires in 7 days.
        </p>
      </div>
    `,
    text: `${greeting} ${opts.inviterName} invited you to AuditHalo as ${opts.roleLabel}. Accept: ${link}\n\nThis invitation expires in 7 days.`,
  });
}

// Used in the page to know whether to show the "Invite Supervisor" button on
// the Supervisor's own view (per org_settings.allowSupervisorsToInvite).
export async function canViewerInviteSupervisees(
  userId: string,
  orgId: string
): Promise<boolean> {
  const membership = await db.query.orgMemberships.findFirst({
    where: and(
      eq(schema.orgMemberships.userId, userId),
      eq(schema.orgMemberships.orgId, orgId)
    ),
  });
  if (!membership) return false;
  if (isHrAdmin(membership.role)) return true;
  if (!canSupervise(membership.role)) return false;
  const settings = await db.query.orgSettings.findFirst({
    where: eq(schema.orgSettings.orgId, orgId),
  });
  return settings?.allowSupervisorsToInvite ?? true;
}
