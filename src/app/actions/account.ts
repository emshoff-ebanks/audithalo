"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import {
  emailVerificationExpiresAt,
  generateAuthToken,
  hashAuthToken,
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
    .set({ passwordHash })
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
 * Consume an email verification token. Marks the user.emailVerifiedAt timestamp
 * only when the token's stored email still matches the user's current email —
 * a defensive check against email changes mid-flight.
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
  if (user.email !== row.email) {
    return {
      ok: false,
      error:
        "Your email address has changed since this link was sent. Please request a new verification email.",
    };
  }

  await db
    .update(schema.users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(schema.users.id, user.id));

  await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.authTokens.id, row.id));

  revalidatePath("/dashboard/account");
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
    .set({ passwordHash })
    .where(eq(schema.users.id, user.id));

  return { ok: true, message: "Password updated." };
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
