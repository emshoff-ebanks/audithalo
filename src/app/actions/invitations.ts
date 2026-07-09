"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, and, isNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { canManageInvitations, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import {
  generateInvitationToken,
  hashToken,
  invitationExpiresAt,
} from "@/lib/invitations";
import { sendEmail } from "@/lib/email";
import { seatCap, seatCapBlockedReason } from "@/lib/billing/seats";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { capture } from "@/lib/observability/posthog-server";

const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";

// Optional rule + dates the supervisor can pin at invite-time so the
// supervisee's rule assignment is created atomically with their org membership
// on accept. ruleId must be a known rule (validated in the action). Dates are
// YYYY-MM-DD strings to match the assign-rule form.
const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  name: z.string().optional(),
  ruleId: z.string().optional(),
  obligationStartedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  supervisionContractFiledAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  // HR Admin's invite form passes this; supervisor's form does not (auto
  // assigns to themselves). Optional; the action resolves the effective
  // value based on the inviter's role.
  assignSupervisorId: z.string().uuid().optional(),
});

const invitationIdSchema = z.object({
  invitationId: z.string().uuid(),
});

export type InviteResult =
  | { ok: true; sentTo: string }
  | {
      ok: false;
      error: string;
      cta?: { label: string; href: string };
    };

export type InvitationActionResult = { ok: true } | { ok: false; error: string };

export async function inviteSuperviseeAction(
  _prev: InviteResult | undefined,
  formData: FormData
): Promise<InviteResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
    ruleId: formData.get("ruleId") || undefined,
    obligationStartedAt: formData.get("obligationStartedAt") || undefined,
    supervisionContractFiledAt:
      formData.get("supervisionContractFiledAt") || undefined,
    assignSupervisorId: formData.get("assignSupervisorId") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const inviteEmail = parsed.data.email.toLowerCase();

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return { ok: false, error: "Your account has no organization yet." };
  }
  if (!canManageInvitations(membership.role)) {
    return {
      ok: false,
      error: "Only supervisors or HR Admins can invite supervisees.",
    };
  }

  // If a rule is pinned, validate the (rule, start-date) pair. Start date is
  // required whenever a rule is picked — the assignment table won't accept null.
  if (parsed.data.ruleId && !parsed.data.obligationStartedAt) {
    return {
      ok: false,
      error: "Pick an obligation start date for the assigned rule.",
    };
  }
  const pendingRuleId = parsed.data.ruleId
    ? parsed.data.ruleId.toLowerCase()
    : null;
  const pendingObligationStartedAt = parsed.data.obligationStartedAt
    ? new Date(`${parsed.data.obligationStartedAt}T00:00:00Z`)
    : null;
  const pendingContractFiledAt = parsed.data.supervisionContractFiledAt
    ? new Date(`${parsed.data.supervisionContractFiledAt}T00:00:00Z`)
    : null;

  // Resolve effective supervisor for the supervisee_assignments row that
  // accept-invite will create:
  //   - If inviter is a Supervisor → auto-assign to themselves (matches
  //     pre-Enterprise behavior; the form doesn't show a picker for them).
  //   - If inviter is HR Admin → use the picked supervisor from the form.
  //     If they didn't pick one, leave null and let HR Admin reassign later
  //     (the "Primary supervisor" card on the supervisee detail page).
  let pendingAssignmentSupervisorId: string | null = null;
  if (membership.role === "supervisor") {
    pendingAssignmentSupervisorId = session.user.id;
  } else if (
    membership.role === "hr_admin" &&
    parsed.data.assignSupervisorId
  ) {
    // Validate the picked supervisor is an active supervisor in this org.
    const supMembership = await db.query.orgMemberships.findFirst({
      where: and(
        eq(schema.orgMemberships.orgId, membership.orgId),
        eq(schema.orgMemberships.userId, parsed.data.assignSupervisorId),
        eq(schema.orgMemberships.role, "supervisor"),
        isNull(schema.orgMemberships.deactivatedAt)
      ),
    });
    if (!supMembership) {
      return {
        ok: false,
        error: "Picked supervisor isn't an active supervisor in this org.",
      };
    }
    pendingAssignmentSupervisorId = parsed.data.assignSupervisorId;
  }

  // If the email already corresponds to a registered user, the existing user
  // can still join — they accept via the same /accept-invite/<token> link and
  // the action recognizes they're already signed up (skips create-account).
  // This is the "convert-on-accept" path: no friction-y error, but the
  // supervisee still has to consent before they show up on the roster.
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, inviteEmail),
  });
  if (existing) {
    // Check they aren't already a member of this org with the same role.
    const dupMembership = await db.query.orgMemberships.findFirst({
      where: and(
        eq(schema.orgMemberships.userId, existing.id),
        eq(schema.orgMemberships.orgId, membership.orgId)
      ),
    });
    if (dupMembership) {
      return {
        ok: false,
        error: "That person is already on your roster.",
      };
    }
  }

  // Re-issue if a non-accepted invitation already exists for this email + org.
  const openInvite = await db.query.invitations.findFirst({
    where: and(
      eq(schema.invitations.orgId, membership.orgId),
      eq(schema.invitations.email, inviteEmail),
      isNull(schema.invitations.acceptedAt)
    ),
  });
  if (openInvite) {
    // Generate a fresh token and update; the old link will no longer work.
    const fresh = generateInvitationToken();
    await db
      .update(schema.invitations)
      .set({
        tokenHash: hashToken(fresh),
        expiresAt: invitationExpiresAt(),
        invitedById: session.user.id,
        name: parsed.data.name ?? openInvite.name,
        pendingRuleId,
        pendingObligationStartedAt,
        pendingContractFiledAt,
        pendingAssignmentSupervisorId,
      })
      .where(eq(schema.invitations.id, openInvite.id));
    await sendInviteEmail({
      to: inviteEmail,
      name: parsed.data.name ?? null,
      token: fresh,
      supervisorName: session.user.name ?? session.user.email,
    });
    try {
      await logAuditEvent({
        orgId: membership.orgId,
        actorUserId: session.user.id,
        action: AUDIT_ACTIONS.INVITATION_RESENT,
        resourceType: "invitation",
        resourceId: openInvite.id,
        details: {
          email: inviteEmail,
          role: "supervisee",
        },
      });
    } catch (err) {
      console.error("[audit-log] failed to record invitation.resent:", err);
    }
    revalidatePath("/dashboard/roster");
    return { ok: true, sentTo: inviteEmail };
  }

  const [org, members, openInvites] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(schema.organizations.id, membership.orgId),
    }),
    db.query.orgMemberships.findMany({
      where: and(
        eq(schema.orgMemberships.orgId, membership.orgId),
        eq(schema.orgMemberships.role, "supervisee")
      ),
    }),
    db.query.invitations.findMany({
      where: and(
        eq(schema.invitations.orgId, membership.orgId),
        eq(schema.invitations.role, "supervisee"),
        isNull(schema.invitations.acceptedAt)
      ),
    }),
  ]);

  if (!org) {
    return { ok: false, error: "Organization not found." };
  }

  const used = members.length + openInvites.length;
  const blocked = seatCapBlockedReason(org, used);
  if (blocked) {
    return {
      ok: false,
      error: blocked.message,
      cta: { label: blocked.ctaLabel, href: blocked.ctaHref },
    };
  }

  const token = generateInvitationToken();

  // Atomic insert with seat-cap re-check to prevent TOCTOU race when two
  // invitations are submitted concurrently. The subquery re-counts at INSERT
  // time inside Postgres, so concurrent inserts serialize on the row lock.
  const cap = seatCap(org);
  const tokenHash = hashToken(token);
  const expires = invitationExpiresAt();

  const inserted = await db.execute(sql`
    INSERT INTO invitations (org_id, email, name, role, token_hash, invited_by_id, expires_at,
      pending_rule_id, pending_obligation_started_at, pending_contract_filed_at, pending_assignment_supervisor_id)
    SELECT
      ${membership.orgId}, ${inviteEmail}, ${parsed.data.name ?? null}, 'supervisee',
      ${tokenHash}, ${session.user.id}, ${expires.toISOString()}::timestamptz,
      ${pendingRuleId ?? null}, ${pendingObligationStartedAt?.toISOString() ?? null}::timestamptz,
      ${pendingContractFiledAt?.toISOString() ?? null}::timestamptz, ${pendingAssignmentSupervisorId ?? null}
    WHERE (
      (SELECT COUNT(*) FROM org_memberships WHERE org_id = ${membership.orgId} AND role = 'supervisee')
      + (SELECT COUNT(*) FROM invitations WHERE org_id = ${membership.orgId} AND role = 'supervisee' AND accepted_at IS NULL)
    ) < ${cap ?? 999999}
    RETURNING id
  `);

  const insertedRows = (inserted as unknown as { rows: { id: string }[] }).rows;
  if (!insertedRows.length) {
    return {
      ok: false,
      error: "Seat limit reached. Upgrade your plan or remove inactive members to invite more supervisees.",
    };
  }

  const insertedInvitation = insertedRows[0];

  await sendInviteEmail({
    to: inviteEmail,
    name: parsed.data.name ?? null,
    token,
    supervisorName: session.user.name ?? session.user.email,
  });

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.INVITATION_SENT,
      resourceType: "invitation",
      resourceId: insertedInvitation.id,
      details: {
        email: inviteEmail,
        role: "supervisee",
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to record invitation.sent:", err);
  }

  capture("supervisee_added", session.user.id, {
    orgId: membership.orgId,
    invitationId: insertedInvitation.id,
    pinnedRuleAtInvite: !!pendingRuleId,
  });

  revalidatePath("/dashboard/roster");
  return { ok: true, sentTo: inviteEmail };
}

async function sendInviteEmail(opts: {
  to: string;
  name: string | null;
  token: string;
  supervisorName: string;
}) {
  const link = `${APP_URL}/accept-invite/${opts.token}`;
  const greeting = opts.name ? `Hi ${opts.name},` : "Hi,";
  await sendEmail({
    to: opts.to,
    subject: `${opts.supervisorName} invited you to AuditHalo`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#08111F; max-width: 560px;">
        <h2 style="font-size: 24px; margin: 0 0 16px;">You're on a supervision roster.</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          ${greeting} <strong>${opts.supervisorName}</strong> has added you to their AuditHalo roster.
          Your supervisee account is free, forever — AuditHalo tracks your supervised hours
          against your state's licensure rule, prompts you about upcoming sessions, and keeps your
          evidence packages audit-ready.
        </p>
        <p style="margin: 32px 0;">
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background:#071A3D; color:#FBFAF6; text-decoration:none; font-weight:600; border-radius: 4px;">
            Accept invite and create account
          </a>
        </p>
        <p style="font-size: 13px; color: #5f6470;">
          Or copy this link: ${link}<br />
          This invitation expires in 7 days.
        </p>
      </div>
    `,
    text: `${greeting} ${opts.supervisorName} has added you to their AuditHalo roster. Accept the invite and create your free supervisee account: ${link}\n\nThis invitation expires in 7 days.`,
  });
}

/** Cancel a pending invitation. Hard-deletes the row. */
export async function cancelInvitationAction(
  _prev: InvitationActionResult | undefined,
  formData: FormData
): Promise<InvitationActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = invitationIdSchema.safeParse({
    invitationId: formData.get("invitationId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid invitation." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return { ok: false, error: "No organization." };
  }
  if (!canManageInvitations(membership.role)) {
    return {
      ok: false,
      error: "Only supervisors or HR Admins can cancel invitations.",
    };
  }

  const invite = await db.query.invitations.findFirst({
    where: eq(schema.invitations.id, parsed.data.invitationId),
  });
  // Collapse "not found" and "wrong org" into the same response so the
  // distinct error strings can't be used to enumerate valid invitation IDs
  // across other organizations.
  if (!invite || invite.orgId !== membership.orgId) {
    return { ok: false, error: "Invitation not found." };
  }
  if (invite.acceptedAt) {
    return {
      ok: false,
      error: "This invitation has already been accepted — remove the supervisee from the roster instead.",
    };
  }

  await db
    .delete(schema.invitations)
    .where(eq(schema.invitations.id, parsed.data.invitationId));

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.INVITATION_CANCELED,
      resourceType: "invitation",
      resourceId: parsed.data.invitationId,
      details: {
        email: invite.email,
        role: invite.role,
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to record invitation.canceled:", err);
  }

  revalidatePath("/dashboard/roster");
  return { ok: true };
}

/** Resend a pending invitation: regenerate token + re-send email. */
export async function resendInvitationAction(
  _prev: InvitationActionResult | undefined,
  formData: FormData
): Promise<InvitationActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = invitationIdSchema.safeParse({
    invitationId: formData.get("invitationId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid invitation." };
  }

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return { ok: false, error: "No organization." };
  }
  if (!canManageInvitations(membership.role)) {
    return {
      ok: false,
      error: "Only supervisors or HR Admins can resend invitations.",
    };
  }

  const invite = await db.query.invitations.findFirst({
    where: eq(schema.invitations.id, parsed.data.invitationId),
  });
  // Same enumeration mitigation as cancelInvitationAction above.
  if (!invite || invite.orgId !== membership.orgId) {
    return { ok: false, error: "Invitation not found." };
  }
  if (invite.acceptedAt) {
    return { ok: false, error: "This invitation has already been accepted." };
  }

  const fresh = generateInvitationToken();
  await db
    .update(schema.invitations)
    .set({
      tokenHash: hashToken(fresh),
      expiresAt: invitationExpiresAt(),
      invitedById: session.user.id,
    })
    .where(eq(schema.invitations.id, invite.id));

  await sendInviteEmail({
    to: invite.email,
    name: invite.name,
    token: fresh,
    supervisorName: session.user.name ?? session.user.email,
  });

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.INVITATION_RESENT,
      resourceType: "invitation",
      resourceId: invite.id,
      details: {
        email: invite.email,
        role: invite.role,
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to record invitation.resent:", err);
  }

  revalidatePath("/dashboard/roster");
  return { ok: true };
}
