import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptToken, decryptToken } from "@/lib/crypto";

beforeAll(() => {
  // 32 random bytes, base64-encoded — same shape as the prod key.
  process.env.MS_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encryptToken / decryptToken", () => {
  it("round-trips a typical OAuth access token", () => {
    const token =
      "EwBoA8l6BAAUO7Acg5fSC1pH6f3JT1234567890ABCD.AQAAAFakeTokenSampleForTesting==";
    const encrypted = encryptToken(token);
    expect(encrypted).not.toBe(token);
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decryptToken(encrypted)).toBe(token);
  });

  it("produces a different ciphertext each call for the same plaintext (random IV)", () => {
    const a = encryptToken("hello");
    const b = encryptToken("hello");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("hello");
    expect(decryptToken(b)).toBe("hello");
  });

  it("refuses to encrypt empty input", () => {
    expect(() => encryptToken("")).toThrow(/empty plaintext/i);
  });

  it("refuses to decrypt input that's too short to be valid GCM output", () => {
    expect(() => decryptToken("abc")).toThrow(/too short/i);
  });

  it("rejects tampered ciphertext via auth-tag failure", () => {
    const original = encryptToken("real-token-value");
    // Flip a byte in the ciphertext region (after iv + auth tag = first 28 bytes)
    const buf = Buffer.from(original, "base64");
    buf[buf.length - 1] = buf[buf.length - 1] ^ 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("handles a 4kb token (refresh tokens can be long)", () => {
    const big = "x".repeat(4096);
    expect(decryptToken(encryptToken(big))).toBe(big);
  });
});
