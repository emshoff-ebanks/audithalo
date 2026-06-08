"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { db, schema } from "@/lib/db";
import { hashToken } from "@/lib/invitations";
import { auth, signIn } from "@/auth";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";
import { capture } from "@/lib/observability/posthog-server";

// Shared shape: the invitation token. Separate schemas for the new-account and
// existing-user paths because the new-account path requires (name, password)
// to provision the account, while the existing-user path requires neither.
const newAccountSchema = z.object({
  token: z.string().length(64, "Invalid invitation token."),
  name: z.string().min(2, "Name must be at least 2 characters."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const existingUserSchema = z.object({
  token: z.string().length(64, "Invalid invitation token."),
});

export type AcceptInviteResult = { ok: true } | { ok: false; error: string };

/**
 * New-account flow: the invitee has no AuditHalo account yet. They provide a
 * name + password; this action provisions the user, adds them to the org,
 * applies the pending rule (if any), marks the invitation accepted, and signs
 * them in.
 */
export async function acceptInviteAction(
  _prev: AcceptInviteResult | undefined,
  formData: FormData
): Promise<AcceptInviteResult> {
  const parsed = newAccountSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { token, name, password } = parsed.data;
  const tokenHash = hashToken(token);

  const invite = await db.query.invitations.findFirst({
    where: and(
      eq(schema.invitations.tokenHash, tokenHash),
      isNull(schema.invitations.acceptedAt)
    ),
  });
  if (!invite) {
    return { ok: false, error: "This invitation is invalid or has already been used." };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This invitation has expired. Ask your supervisor to resend it." };
  }

  // If a user with this email already exists, the user is on the wrong path —
  // they should be signing in to accept (existing-user flow). Return a clear
  // message; the accept-invite page will route them to the right form.
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, invite.email),
  });
  if (existing) {
    return {
      ok: false,
      error: "An account with this email already exists. Sign in to accept the invite.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(schema.users)
    .values({
      email: invite.email,
      passwordHash,
      name,
      role: invite.role,
    })
    .returning();

  await db.insert(schema.orgMemberships).values({
    orgId: invite.orgId,
    userId: user.id,
    role: invite.role,
  });

  // Apply the pending rule assignment if the supervisor pinned one at invite.
  // Failure here must not block account creation — the supervisor can re-assign
  // from the roster after the user signs in.
  if (invite.pendingRuleId && invite.pendingObligationStartedAt) {
    try {
      await db.insert(schema.superviseeRuleAssignments).values({
        superviseeId: user.id,
        orgId: invite.orgId,
        ruleId: invite.pendingRuleId,
        obligationStartedAt: invite.pendingObligationStartedAt,
        supervisionContractFiledAt: invite.pendingContractFiledAt,
      });
    } catch (err) {
      console.error(
        `[accept-invite] failed to apply pending rule ${invite.pendingRuleId}:`,
        err
      );
    }
  }

  // For supervisee invites, create the supervisor_assignments row with the
  // supervisor that the inviter chose. Self-assign-to-inviting-supervisor
  // is handled in inviteSuperviseeAction (writes pendingAssignmentSupervisorId
  // = inviter.id); HR Admin's picked supervisor is the same field. Null means
  // HR Admin didn't pick — leave unassigned; they'll reassign from the team
  // page or supervisee detail page.
  if (invite.role === "supervisee" && invite.pendingAssignmentSupervisorId) {
    try {
      await db.insert(schema.supervisorAssignments).values({
        orgId: invite.orgId,
        supervisorId: invite.pendingAssignmentSupervisorId,
        superviseeId: user.id,
        isPrimary: true,
      });
    } catch (err) {
      console.error(
        `[accept-invite] failed to create supervisor_assignments row:`,
        err
      );
    }
  }

  await db
    .update(schema.invitations)
    .set({
      acceptedAt: new Date(),
      acceptedById: user.id,
    })
    .where(eq(schema.invitations.id, invite.id));

  try {
    await logAuditEvent({
      orgId: invite.orgId,
      actorUserId: user.id,
      action: AUDIT_ACTIONS.INVITATION_ACCEPTED,
      resourceType: "invitation",
      resourceId: invite.id,
      details: { email: invite.email },
    });
  } catch (err) {
    console.error("[audit-log] failed to record invitation.accepted:", err);
  }

  capture("supervisee_signup_free", user.id, {
    orgId: invite.orgId,
    invitationId: invite.id,
    invitedById: invite.invitedById,
    pinnedRuleAtInvite: !!invite.pendingRuleId,
  });

  // Bust the inviting supervisor's cached dashboard + roster so the new
  // supervisee appears on their next navigation (no stale 404 / empty row).
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/roster");

  // Notify the supervisor who originally sent the invite. createNotification
  // writes the bell row and (when the inviter opts in for invite_accepted —
  // default true) sends the email side-effect. Failure must never block the
  // action — wrapped in try/catch.
  try {
    await createNotification({
      userId: invite.invitedById,
      kind: "invite_accepted",
      payload: {
        superviseeId: user.id,
        superviseeName: user.name ?? user.email,
        superviseeEmail: user.email,
      },
    });
  } catch (err) {
    console.error("[notifications] invite_accepted failed:", err);
  }

  try {
    await signIn("credentials", {
      email: invite.email,
      password,
      redirectTo: "/dashboard",
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Account created — please sign in to continue." };
    }
    throw err;
  }
}

/**
 * Existing-user flow: the invitee already has an AuditHalo account and is
 * signed in. They consent by submitting an acceptance form; this action adds
 * the org membership, applies the pending rule (if any), and marks the
 * invitation accepted. No user is created.
 */
export async function acceptInviteAsExistingUserAction(
  _prev: AcceptInviteResult | undefined,
  formData: FormData
): Promise<AcceptInviteResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Sign in to accept this invitation." };
  }
  const parsed = existingUserSchema.safeParse({
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const tokenHash = hashToken(parsed.data.token);

  const invite = await db.query.invitations.findFirst({
    where: and(
      eq(schema.invitations.tokenHash, tokenHash),
      isNull(schema.invitations.acceptedAt)
    ),
  });
  if (!invite) {
    return { ok: false, error: "This invitation is invalid or has already been used." };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This invitation has expired. Ask your supervisor to resend it." };
  }
  // The signed-in user's email must match the invite. Prevents user A
  // hijacking an invite addressed to user B by capturing their token.
  if (session.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return {
      ok: false,
      error: "This invitation was addressed to a different email. Sign in as that user.",
    };
  }
  const userId = session.user.id;

  // No-op if the user is already a member of this org.
  const dupMembership = await db.query.orgMemberships.findFirst({
    where: and(
      eq(schema.orgMemberships.userId, userId),
      eq(schema.orgMemberships.orgId, invite.orgId)
    ),
  });
  if (!dupMembership) {
    await db.insert(schema.orgMemberships).values({
      orgId: invite.orgId,
      userId,
      role: invite.role,
    });
  }

  // Mirror the membership role to users.role so JWT-based guards
  // (requireHrAdmin, etc.) see the new role on next sign-in. The new-account
  // flow above already gets this right at user creation; the existing-user
  // path needs the explicit sync since users.role wasn't touched at
  // insert-time. Bump sessionsValidFrom so the next request re-issues the
  // JWT instead of carrying the stale role.
  const currentUser = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { role: true },
  });
  if (currentUser && currentUser.role !== invite.role) {
    await db
      .update(schema.users)
      .set({ role: invite.role, sessionsValidFrom: new Date() })
      .where(eq(schema.users.id, userId));
  }

  // Apply the pending rule if pinned. The same try/catch protects the
  // membership write from a downstream insert failure.
  if (invite.pendingRuleId && invite.pendingObligationStartedAt) {
    try {
      await db.insert(schema.superviseeRuleAssignments).values({
        superviseeId: userId,
        orgId: invite.orgId,
        ruleId: invite.pendingRuleId,
        obligationStartedAt: invite.pendingObligationStartedAt,
        supervisionContractFiledAt: invite.pendingContractFiledAt,
      });
    } catch (err) {
      console.error(
        `[accept-invite] failed to apply pending rule ${invite.pendingRuleId}:`,
        err
      );
    }
  }

  if (invite.role === "supervisee" && invite.pendingAssignmentSupervisorId) {
    try {
      await db.insert(schema.supervisorAssignments).values({
        orgId: invite.orgId,
        supervisorId: invite.pendingAssignmentSupervisorId,
        superviseeId: userId,
        isPrimary: true,
      });
    } catch (err) {
      console.error(
        `[accept-invite] failed to create supervisor_assignments row:`,
        err
      );
    }
  }

  await db
    .update(schema.invitations)
    .set({
      acceptedAt: new Date(),
      acceptedById: userId,
    })
    .where(eq(schema.invitations.id, invite.id));

  try {
    await logAuditEvent({
      orgId: invite.orgId,
      actorUserId: userId,
      action: AUDIT_ACTIONS.INVITATION_ACCEPTED,
      resourceType: "invitation",
      resourceId: invite.id,
      details: { email: invite.email },
    });
  } catch (err) {
    console.error("[audit-log] failed to record invitation.accepted:", err);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/roster");

  try {
    await createNotification({
      userId: invite.invitedById,
      kind: "invite_accepted",
      payload: {
        superviseeId: userId,
        superviseeName: session.user.name ?? session.user.email,
        superviseeEmail: session.user.email,
      },
    });
  } catch (err) {
    console.error("[notifications] invite_accepted failed:", err);
  }

  return { ok: true };
}
