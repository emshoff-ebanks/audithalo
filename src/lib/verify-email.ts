import { and, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashAuthToken, isEmailChangeToken } from "@/lib/auth-tokens";

/**
 * Core email-verification logic extracted from verifyEmailAction so it can be
 * called from a server-component render pass (GET) without triggering
 * revalidatePath (which corrupts the RSC response outside a POST/mutation
 * context).
 *
 * Covers both initial-verification and email-change flows.
 */
export async function verifyEmailToken(
  rawToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!rawToken) {
    return { ok: false, error: "Missing verification token." };
  }

  const tokenHash = hashAuthToken(rawToken);
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

  return { ok: true };
}
