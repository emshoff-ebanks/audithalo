import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM token encryption.
 *
 * Used for storing OAuth access/refresh tokens at rest in
 * `user_calendar_integrations`. The encryption key is base64-encoded 32
 * bytes set via the `MS_TOKEN_ENCRYPTION_KEY` env var. The same key is
 * used for Google tokens — reusing one key across providers per the
 * locked decision in `docs/strategy/08-scheduling-and-calendar.md`.
 *
 * Output format: base64(iv || authTag || ciphertext)
 *   - iv: 12 bytes (96-bit, GCM-standard nonce length)
 *   - authTag: 16 bytes (GCM authenticator)
 *   - ciphertext: variable
 *
 * Rotate the key: NEVER, unless you're willing to invalidate every stored
 * token (forcing all users to re-OAuth). Treat it as load-bearing.
 */

const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const ALGORITHM = "aes-256-gcm";

function loadKey(): Buffer {
  const raw = process.env.MS_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "MS_TOKEN_ENCRYPTION_KEY is not set. Token encryption requires a 32-byte base64 key."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `MS_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}).`
    );
  }
  return key;
}

/** Encrypt a string with AES-256-GCM. Returns base64(iv || authTag || ciphertext). */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    throw new Error("encryptToken: refusing to encrypt empty plaintext.");
  }
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new Error(`Unexpected GCM auth tag length: ${authTag.length}`);
  }
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Decrypt a base64-encoded payload produced by encryptToken. */
export function decryptToken(payload: string): string {
  if (!payload) {
    throw new Error("decryptToken: empty payload.");
  }
  const key = loadKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_BYTES + AUTH_TAG_BYTES + 1) {
    throw new Error("decryptToken: payload too short to be valid GCM output.");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
