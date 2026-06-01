import { createHash, randomBytes } from "node:crypto";

/** Generate a random 32-byte hex token suitable for invitation links. */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash a token for DB storage. Use the SAME hash function on lookup. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Default expiration window for new invitations. */
export const INVITATION_TTL_DAYS = 7;

export function invitationExpiresAt(): Date {
  return new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}
