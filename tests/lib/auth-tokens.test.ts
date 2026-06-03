import { describe, it, expect } from "vitest";
import {
  generateAuthToken,
  hashAuthToken,
  passwordResetExpiresAt,
  emailVerificationExpiresAt,
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
});
