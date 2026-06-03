/**
 * TOTP (RFC 6238) helpers for opt-in two-factor authentication.
 *
 * Design notes:
 *   * Secrets are base32-encoded. otplib v13 uses 20 bytes (160 bits) of
 *     entropy by default — well above the 80-bit minimum recommended in RFC.
 *   * Verification tolerance is ±30s (one full step) to absorb clock drift
 *     between server and the user's device. This is the standard practice.
 *   * Backup codes are 8-char hex (32 bits of entropy each). Stored as
 *     SHA-256 hashes; the plaintext is shown to the user ONCE at setup.
 *     Each code is single-use — consumed on first valid match.
 *   * All exported helpers are pure (no DB / no env). The DB persistence
 *     happens in src/app/actions/account.ts and the consume-on-use logic
 *     for backup codes happens in src/auth.ts.
 *
 * Uses otplib v13's functional API (generateSecret, generateURI, verifySync).
 */

import {
  generateSecret,
  generateURI,
  verifySync,
} from "otplib";
import { createHash, randomBytes } from "node:crypto";

const APP_NAME = "AuditHalo";
// One full 30s step of clock-drift tolerance in either direction.
const EPOCH_TOLERANCE_SECONDS = 30;

/** Generate a new TOTP secret (base32). */
export function generateTotpSecret(): string {
  return generateSecret();
}

/**
 * Build the otpauth:// URI for a QR code. The account label is the user's
 * email — what authenticator apps will display next to the 6-digit code.
 */
export function buildOtpAuthUri(secret: string, accountName: string): string {
  return generateURI({
    issuer: APP_NAME,
    label: accountName,
    secret,
  });
}

/**
 * Verify a 6-digit TOTP code against a secret. Returns true on match.
 * Strips spaces from the input so users who paste "123 456" succeed.
 */
export function verifyTotpCode(code: string, secret: string): boolean {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  try {
    const result = verifySync({
      token: normalized,
      secret,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    });
    return result.valid === true;
  } catch {
    return false;
  }
}

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_BYTES = 4; // 8 hex chars per code, 32 bits of entropy

/**
 * Generate 10 single-use backup codes. Returns both the plaintext (to show
 * the user exactly once) and the SHA-256 hashes (to store in the DB).
 */
export function generateBackupCodes(): {
  plaintextCodes: string[];
  hashedCodes: string[];
} {
  const plaintextCodes: string[] = [];
  const hashedCodes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const raw = randomBytes(BACKUP_CODE_BYTES).toString("hex");
    plaintextCodes.push(raw);
    hashedCodes.push(hashBackupCode(raw));
  }
  return { plaintextCodes, hashedCodes };
}

/**
 * Hash a backup code for DB storage. Normalizes (lowercase + trim) so the
 * user can type their backup code in any case and with surrounding spaces.
 */
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.toLowerCase().trim()).digest("hex");
}

/**
 * Pure: given a candidate backup code and the stored hash list, return the
 * index of the matching hash so the caller can remove that hash from the
 * stored array (single-use semantics). Returns -1 on no match.
 */
export function findBackupCodeMatch(
  candidate: string,
  storedHashes: string[]
): number {
  const candidateHash = hashBackupCode(candidate);
  return storedHashes.findIndex((h) => h === candidateHash);
}
