"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { db, schema } from "@/lib/db";
import { signIn, signOut } from "@/auth";
import {
  emailVerificationExpiresAt,
  generateAuthToken,
  hashAuthToken,
} from "@/lib/auth-tokens";
import { sendEmailVerificationEmail } from "@/lib/email";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string; needsTotp?: undefined }
  | { ok: false; needsTotp: true; error?: undefined };

export async function signupAction(
  _prev: AuthActionResult | undefined,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, email, password } = parsed.data;
  const emailLower = email.trim().toLowerCase();

  const rl = await checkRateLimit(
    emailLower,
    "signup",
    RATE_LIMITS.signup.maxAttempts,
    RATE_LIMITS.signup.windowSeconds
  );
  if (!rl.allowed) {
    return { ok: false, error: "Too many signup attempts. Please try again later." };
  }

  // Always hash to prevent timing side-channel that reveals email existence
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, emailLower),
  });
  if (existing) {
    return { ok: false, error: "If this email is available, check your inbox for next steps." };
  }

  // Create the user, then create their personal organization, then a membership
  // tying them to it as a supervisor. Default org name uses their first name.
  const [user] = await db
    .insert(schema.users)
    .values({
      email: emailLower,
      passwordHash,
      name,
      role: "supervisor",
    })
    .returning();

  const firstName = name.split(" ")[0] ?? name;
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: `${firstName}'s practice`,
      createdById: user.id,
    })
    .returning();

  await db.insert(schema.orgMemberships).values({
    orgId: org.id,
    userId: user.id,
    role: "supervisor",
  });

  // Fire off the verification email — don't block signup if the send fails.
  try {
    const raw = generateAuthToken();
    await db.insert(schema.authTokens).values({
      userId: user.id,
      kind: "email_verification",
      tokenHash: hashAuthToken(raw),
      email: user.email,
      expiresAt: emailVerificationExpiresAt(),
    });
    await sendEmailVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl: `${APP_URL}/verify-email/${raw}`,
    });
  } catch (err) {
    console.error("[auth] signup verification email failed:", err);
  }

  try {
    await signIn("credentials", {
      email: emailLower,
      password,
      redirectTo: "/dashboard",
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Account created, but automatic sign-in failed. Please log in." };
    }
    throw err; // NEXT_REDIRECT is re-thrown so Next handles it
  }
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  // Optional second factor — only relevant for users with 2FA enabled.
  // Left blank by users without 2FA; ignored on the server in that case.
  totpCode: z.string().optional(),
});

export async function loginAction(
  _prev: AuthActionResult | undefined,
  formData: FormData
): Promise<AuthActionResult> {
  const rawTotp = formData.get("totpCode");
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totpCode:
      typeof rawTotp === "string" && rawTotp.trim().length > 0
        ? rawTotp
        : undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const rl = await checkRateLimit(
    parsed.data.email,
    "login",
    RATE_LIMITS.login.maxAttempts,
    RATE_LIMITS.login.windowSeconds
  );
  if (!rl.allowed) {
    return { ok: false, error: "Too many login attempts. Please try again in a few minutes." };
  }

  const emailLower = parsed.data.email.toLowerCase();

  // Two-step TOTP flow: if no code was provided, pre-check credentials
  // and signal the client to show the TOTP input rather than returning
  // the generic "Invalid email or password" error.
  if (!parsed.data.totpCode) {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, emailLower),
    });
    if (user?.passwordHash && !user.deletedAt) {
      const credentialsOk = await bcrypt.compare(
        parsed.data.password,
        user.passwordHash
      );
      if (credentialsOk && user.totpEnabledAt && user.totpSecret) {
        return { ok: false, needsTotp: true };
      }
    }
  }

  try {
    await signIn("credentials", {
      email: emailLower,
      password: parsed.data.password,
      totpCode: parsed.data.totpCode ?? "",
      redirectTo: "/dashboard",
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Invalid email or password." };
    }
    throw err;
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
