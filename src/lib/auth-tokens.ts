import { createHash, randomBytes } from "node:crypto";

/** Generate a random 32-byte hex token suitable for password reset or email verification links. */
export function generateAuthToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash a token for DB storage. The raw token never lives in the DB. */
export function hashAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Password reset links are short-lived — 1 hour. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
/** Email verification links are forgiving — 7 days. */
export const EMAIL_VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function passwordResetExpiresAt(): Date {
  return new Date(Date.now() + PASSWORD_RESET_TTL_MS);
}

export function emailVerificationExpiresAt(): Date {
  return new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
}

/**
 * Pure: is this token's email different from the user's current email?
 * Identifies email-change vs initial verification. Case-insensitive — we
 * normalise stored emails to lowercase but compare defensively here too.
 */
export function isEmailChangeToken(
  tokenEmail: string,
  currentUserEmail: string
): boolean {
  return tokenEmail.toLowerCase() !== currentUserEmail.toLowerCase();
}
