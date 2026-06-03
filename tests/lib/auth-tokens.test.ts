import { describe, it, expect } from "vitest";
import {
  generateAuthToken,
  hashAuthToken,
  passwordResetExpiresAt,
  emailVerificationExpiresAt,
  isEmailChangeToken,
  isTokenRevoked,
  PASSWORD_RESET_TTL_MS,
  EMAIL_VERIFICATION_TTL_MS,
} from "@/lib/auth-tokens";

describe("auth-tokens", () => {
  it("generateAuthToken returns 64 lowercase hex chars (32 bytes)", () => {
    const token = generateAuthToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generateAuthToken returns unique tokens (entropy check)", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 50; i++) tokens.add(generateAuthToken());
    expect(tokens.size).toBe(50);
  });

  it("hashAuthToken is deterministic and returns 64 hex chars", () => {
    const token = "00112233445566778899aabbccddeeff";
    const a = hashAuthToken(token);
    const b = hashAuthToken(token);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashAuthToken output differs from raw token (defense check)", () => {
    const token = generateAuthToken();
    expect(hashAuthToken(token)).not.toBe(token);
  });

  it("PASSWORD_RESET_TTL_MS is exactly 1 hour", () => {
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("EMAIL_VERIFICATION_TTL_MS is exactly 7 days", () => {
    expect(EMAIL_VERIFICATION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("passwordResetExpiresAt is ~1 hour in the future", () => {
    const now = Date.now();
    const expiry = passwordResetExpiresAt().getTime();
    const delta = expiry - now;
    expect(delta).toBeGreaterThanOrEqual(PASSWORD_RESET_TTL_MS - 1000);
    expect(delta).toBeLessThanOrEqual(PASSWORD_RESET_TTL_MS + 1000);
  });

  it("emailVerificationExpiresAt is ~7 days in the future", () => {
    const now = Date.now();
    const expiry = emailVerificationExpiresAt().getTime();
    const delta = expiry - now;
    expect(delta).toBeGreaterThanOrEqual(EMAIL_VERIFICATION_TTL_MS - 1000);
    expect(delta).toBeLessThanOrEqual(EMAIL_VERIFICATION_TTL_MS + 1000);
  });

  it("isEmailChangeToken returns false when the token email matches", () => {
    expect(isEmailChangeToken("user@example.com", "user@example.com")).toBe(false);
  });

  it("isEmailChangeToken returns true when the token email differs", () => {
    expect(isEmailChangeToken("new@example.com", "old@example.com")).toBe(true);
  });

  it("isEmailChangeToken treats case differences as the same email", () => {
    expect(isEmailChangeToken("User@Example.com", "user@example.COM")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // isTokenRevoked — JWT revocation check
  // -------------------------------------------------------------------------

  it("isTokenRevoked: null sessionsValidFrom means never revoked", () => {
    // iat at epoch — still valid because no cutoff has been set
    expect(isTokenRevoked(0, null)).toBe(false);
    // iat in the future — still valid
    expect(isTokenRevoked(Date.now() / 1000 + 3600, null)).toBe(false);
  });

  it("isTokenRevoked: iat AFTER cutoff is not revoked", () => {
    const cutoff = new Date("2026-01-01T00:00:00.000Z");
    // Token issued 1 second after cutoff
    const iatSeconds = cutoff.getTime() / 1000 + 1;
    expect(isTokenRevoked(iatSeconds, cutoff)).toBe(false);
  });

  it("isTokenRevoked: iat BEFORE cutoff is revoked", () => {
    const cutoff = new Date("2026-01-01T00:00:00.000Z");
    // Token issued 1 second before cutoff
    const iatSeconds = cutoff.getTime() / 1000 - 1;
    expect(isTokenRevoked(iatSeconds, cutoff)).toBe(true);
  });

  it("isTokenRevoked: iat exactly EQUAL to cutoff is not revoked (boundary)", () => {
    // Cutoff at a whole second to avoid floating-point cliffs from ms division
    const cutoff = new Date("2026-01-01T00:00:00.000Z");
    const iatSeconds = cutoff.getTime() / 1000;
    expect(isTokenRevoked(iatSeconds, cutoff)).toBe(false);
  });
});
