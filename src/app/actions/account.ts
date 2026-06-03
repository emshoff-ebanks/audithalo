"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import {
  emailVerificationExpiresAt,
  generateAuthToken,
  hashAuthToken,
  isEmailChangeToken,
  passwordResetExpiresAt,
} from "@/lib/auth-tokens";
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from "@/lib/email";

const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";

export type AccountActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

// ----------------------------------------------------------------------------
// Password reset
// ----------------------------------------------------------------------------

const requestPasswordResetSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

/**
 * Request a password reset link. Always returns the same success message,
 * whether or not the email is registered — defense against email enumeration.
 */
export async function requestPasswordResetAction(
  _prev: AccountActionResult | undefined,
  formData: FormData
): Promise<AccountActionResult> {
  const parsed = requestPasswordResetSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const successMessage =
    "If an account exists for that email, we've sent a reset link.";
  const emailLower = parsed.data.email.toLowerCase();

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, emailLower),
  });

  // Always return success — never reveal whether an account exists.
  if (!user) {
    return { ok: true, message: successMessage };
  }

  // Invalidate any prior unused password_reset tokens for this user so the
  // most recent link is the only one that works.
  await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.authTokens.userId, user.id),
        eq(schema.authTokens.kind, "password_reset"),
        isNull(schema.authTokens.usedAt)
      )
    );

  const raw = generateAuthToken();
  await db.insert(schema.authTokens).values({
    userId: user.id,
    kind: "password_reset",
    tokenHash: hashAuthToken(raw),
    email: user.email,
    expiresAt: passwordResetExpiresAt(),
  });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: `${APP_URL}/reset-password/${raw}`,
    });
  } catch (err) {
    // Don't roll back the DB write on email failure — just log and still
    // return the canonical success message.
    console.error("[account] sendPasswordResetEmail failed:", err);
  }

  return { ok: true, message: successMessage };
}

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Missing reset token."),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

/**
 * Consume a password reset token and replace the user's password.
 */
export async function resetPasswordAction(
  _prev: AccountActionResult | undefined,
  formData: FormData
): Promise<AccountActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const tokenHash = hashAuthToken(parsed.data.token);
  const row = await db.query.authTokens.findFirst({
    where: and(
      eq(schema.authTokens.tokenHash, tokenHash),
      eq(schema.authTokens.kind, "password_reset"),
      isNull(schema.authTokens.usedAt)
    ),
  });

  if (!row) {
    return {
      ok: false,
      error: "This reset link is invalid or has already been used.",
    };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "This reset link has expired. Request a new one.",
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  await db
    .update(schema.users)
    .set({
      passwordHash,
      // A password reset is a security event — invalidate every prior
      // session on every device. Any attacker session is now dead.
      sessionsValidFrom: new Date(),
    })
    .where(eq(schema.users.id, row.userId));

  await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.authTokens.id, row.id));

  return { ok: true };
}

// ----------------------------------------------------------------------------
// Email verification
// ----------------------------------------------------------------------------

/**
 * Sends (or re-sends) an email verification link to the current user's email.
 * Requires an authenticated session. No-op if email is already verified.
 */
export async function requestEmailVerificationAction(): Promise<AccountActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
  });
  if (!user) return { ok: false, error: "Account not found." };
  if (user.emailVerifiedAt) {
    return { ok: false, error: "Email already verified." };
  }

  // Invalidate any prior unused email_verification tokens for this user.
  await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.authTokens.userId, user.id),
        eq(schema.authTokens.kind, "email_verification"),
        isNull(schema.authTokens.usedAt)
      )
    );

  const raw = generateAuthToken();
  await db.insert(schema.authTokens).values({
    userId: user.id,
    kind: "email_verification",
    tokenHash: hashAuthToken(raw),
    email: user.email,
    expiresAt: emailVerificationExpiresAt(),
  });

  try {
    await sendEmailVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl: `${APP_URL}/verify-email/${raw}`,
    });
  } catch (err) {
    console.error("[account] sendEmailVerificationEmail failed:", err);
  }

  return {
    ok: true,
    message: `Verification email sent to ${user.email}.`,
  };
}

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Missing verification token."),
});

/**
 * Consume an email verification token. Marks user.emailVerifiedAt = now() and
 * sets user.email to the token's stored email — covering two cases:
 *   1. Initial-verification / verify-current-email: token.email === user.email, so
 *      the email write is a no-op and only emailVerifiedAt changes.
 *   2. Email-change flow: token.email !== user.email; this swaps the address
 *      atomically with marking it verified. Before swapping we re-check that
 *      no other user has grabbed the new email since the change was requested.
 */
export async function verifyEmailAction(
  rawToken: string
): Promise<AccountActionResult> {
  const parsed = verifyEmailSchema.safeParse({ token: rawToken });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid token.",
    };
  }

  const tokenHash = hashAuthToken(parsed.data.token);
  const row = await db.query.authTokens.findFirst({
    where: and(
      eq(schema.authTokens.tokenHash, tokenHash),
      eq(schema.authTokens.kind, "email_verification"),
      isNull(schema.authTokens.usedAt)
    ),
  });

  if (!row) {
    return {
      ok: false,
      error: "This verification link is invalid or has already been used.",
    };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "This verification link has expired. Request a new one.",
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, row.userId),
  });
  if (!user) {
    return { ok: false, error: "Account not found." };
  }

  const newEmailLower = row.email.toLowerCase();

  // Email-change path: someone might have signed up with the new address
  // between request and verify. Re-check before swapping.
  if (isEmailChangeToken(row.email, user.email)) {
    const conflict = await db.query.users.findFirst({
      where: and(
        eq(schema.users.email, newEmailLower),
        ne(schema.users.id, user.id)
      ),
    });
    if (conflict) {
      return {
        ok: false,
        error:
          "Another account has been created with this email since you requested the change. Try again with a different email.",
      };
    }
  }

  await db
    .update(schema.users)
    .set({
      email: newEmailLower,
      emailVerifiedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id));

  await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.authTokens.id, row.id));

  revalidatePath("/dashboard/account");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Email change — request side. Verification side is verifyEmailAction above.
// ----------------------------------------------------------------------------

const requestEmailChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newEmail: z.string().email("Enter a valid email address."),
});

/**
 * Begin an email-change. Requires the user's current password (defence against
 * session hijack). The new email is NOT applied until the user clicks the
 * verification link sent to the new address — until then, the current email
 * stays active.
 */
export async function requestEmailChangeAction(
  _prev: AccountActionResult | undefined,
  formData: FormData
): Promise<AccountActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = requestEmailChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newEmail: formData.get("newEmail"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const newEmailLower = parsed.data.newEmail.toLowerCase();

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
  });
  if (!user || !user.passwordHash) {
    return { ok: false, error: "Account not found." };
  }

  const passwordOk = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash
  );
  if (!passwordOk) {
    return { ok: false, error: "Current password is incorrect." };
  }

  if (newEmailLower === user.email.toLowerCase()) {
    return { ok: false, error: "That is already your email." };
  }

  const conflict = await db.query.users.findFirst({
    where: eq(schema.users.email, newEmailLower),
  });
  if (conflict) {
    return {
      ok: false,
      error: "An account with that email already exists.",
    };
  }

  // Invalidate any prior unused email_verification tokens for this user — so
  // a previously issued "verify current email" link can't be replayed to grant
  // verified status to the new email.
  await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.authTokens.userId, user.id),
        eq(schema.authTokens.kind, "email_verification"),
        isNull(schema.authTokens.usedAt)
      )
    );

  const raw = generateAuthToken();
  await db.insert(schema.authTokens).values({
    userId: user.id,
    kind: "email_verification",
    tokenHash: hashAuthToken(raw),
    email: newEmailLower,
    expiresAt: emailVerificationExpiresAt(),
  });

  try {
    await sendEmailVerificationEmail({
      to: newEmailLower,
      name: user.name,
      verifyUrl: `${APP_URL}/verify-email/${raw}`,
    });
  } catch (err) {
    // Token already exists in the DB; user can request another change if the
    // send fails. Don't roll back — surface success and log.
    console.error(
      "[account] email-change verification email failed:",
      err
    );
  }

  return { ok: true };
}

// ----------------------------------------------------------------------------
// Profile self-edit
// ----------------------------------------------------------------------------

const updateNameSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
});

export async function updateNameAction(
  _prev: AccountActionResult | undefined,
  formData: FormData
): Promise<AccountActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = updateNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  await db
    .update(schema.users)
    .set({ name: parsed.data.name.trim() })
    .where(eq(schema.users.id, session.user.id));

  revalidatePath("/dashboard/account");
  revalidatePath("/dashboard");
  return { ok: true, message: "Name updated." };
}

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
});

export async function updatePasswordAction(
  _prev: AccountActionResult | undefined,
  formData: FormData
): Promise<AccountActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = updatePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
  });
  if (!user || !user.passwordHash) {
    return { ok: false, error: "Account not found." };
  }

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db
    .update(schema.users)
    .set({
      passwordHash,
      // A password change is a security event — invalidate every prior
      // session (including this device). The user will need to sign in
      // again with their new password. Accept the friction.
      sessionsValidFrom: new Date(),
    })
    .where(eq(schema.users.id, user.id));

  return { ok: true, message: "Password updated." };
}

// ----------------------------------------------------------------------------
// Session revocation — "Sign out everywhere"
// ----------------------------------------------------------------------------

/**
 * Bumps the user's `sessionsValidFrom` to now, invalidating every JWT
 * issued before this moment — including the JWT of the device that ran
 * this action. On the very next request the JWT callback will see iat
 * < sessionsValidFrom and return null, forcing a redirect to /login.
 */
export async function signOutEverywhereAction(
  _prev: AccountActionResult | undefined,
  _formData: FormData
): Promise<AccountActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  await db
    .update(schema.users)
    .set({ sessionsValidFrom: new Date() })
    .where(eq(schema.users.id, session.user.id));

  return { ok: true, message: "Signed out of all sessions." };
}

// ----------------------------------------------------------------------------
// Supervisor training hours (CA 16 CCR §1822 requires 15)
// ----------------------------------------------------------------------------

const trainingHoursSchema = z.object({
  hours: z.coerce.number().int().nonnegative().max(10000),
});

export async function updateSupervisorTrainingHoursAction(
  _prev: AccountActionResult | undefined,
  formData: FormData
): Promise<AccountActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canSupervise(membership.role)) {
    return { ok: false, error: "Only supervisors can record training hours." };
  }

  const parsed = trainingHoursSchema.safeParse({
    hours: formData.get("hours"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  await db
    .update(schema.users)
    .set({ supervisorTrainingHours: parsed.data.hours })
    .where(eq(schema.users.id, session.user.id));

  revalidatePath("/dashboard/account");
  return { ok: true, message: "Training hours updated." };
}
