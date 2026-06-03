"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { AuthError } from "next-auth";
import { syncPracticeSeatQuantity } from "@/lib/billing/seats";
import { db, schema } from "@/lib/db";
import { sendInviteAcceptedEmail } from "@/lib/email";
import { hashToken } from "@/lib/invitations";
import { signIn } from "@/auth";

const acceptSchema = z.object({
  token: z.string().length(64, "Invalid invitation token."),
  name: z.string().min(2, "Name must be at least 2 characters."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type AcceptInviteResult = { ok: true } | { ok: false; error: string };

export async function acceptInviteAction(
  _prev: AcceptInviteResult | undefined,
  formData: FormData
): Promise<AcceptInviteResult> {
  const parsed = acceptSchema.safeParse({
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

  // Make sure no user has been created for this email since the invite was sent
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

  await db
    .update(schema.invitations)
    .set({
      acceptedAt: new Date(),
      acceptedById: user.id,
    })
    .where(eq(schema.invitations.id, invite.id));

  try {
    await syncPracticeSeatQuantity(invite.orgId);
  } catch (err) {
    // Don't block the user accept on a Stripe sync failure — we'll reconcile later.
    console.error(`[accept-invite] seat sync failed for org ${invite.orgId}:`, err);
  }

  // Notify the supervisor who originally sent the invite. Email failure must
  // NEVER block the action — wrapped in try/catch.
  try {
    const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";
    const inviter = await db.query.users.findFirst({
      where: eq(schema.users.id, invite.invitedById),
    });
    if (inviter?.email) {
      await sendInviteAcceptedEmail({
        to: inviter.email,
        supervisorName: inviter.name ?? inviter.email,
        superviseeName: user.name ?? user.email,
        superviseeEmail: user.email,
        rosterUrl: `${APP_URL}/dashboard/roster/${user.id}`,
      });
    }
  } catch (err) {
    console.error("[email] invite-accepted notification failed:", err);
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
