import { describe, it, expect } from "vitest";
import { generateSync } from "otplib";
import {
  generateTotpSecret,
  buildOtpAuthUri,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
  findBackupCodeMatch,
} from "@/lib/totp";

describe("generateTotpSecret", () => {
  it("returns a base32-encoded secret", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+=*$/);
    expect(s.length).toBeGreaterThan(10);
  });

  it("generates unique secrets each call", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
  });
});

describe("buildOtpAuthUri", () => {
  it("includes the app name and account", () => {
    const uri = buildOtpAuthUri("JBSWY3DPEHPK3PXP", "user@example.com");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("AuditHalo");
    expect(uri).toContain("user%40example.com");
  });
});

describe("verifyTotpCode", () => {
  it("accepts a valid current code", () => {
    const secret = generateTotpSecret();
    const code = generateSync({ secret });
    expect(verifyTotpCode(code, secret)).toBe(true);
  });

  it("strips spaces from the input", () => {
    const secret = generateTotpSecret();
    const code = generateSync({ secret });
    const spaced = code.slice(0, 3) + " " + code.slice(3);
    expect(verifyTotpCode(spaced, secret)).toBe(true);
  });

  it("rejects a non-6-digit input", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode("12345", secret)).toBe(false);
    expect(verifyTotpCode("abcdef", secret)).toBe(false);
    expect(verifyTotpCode("1234567", secret)).toBe(false);
  });

  it("rejects a wrong code", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode("000000", secret)).toBe(false);
  });
});

describe("generateBackupCodes", () => {
  it("returns 10 codes with matching hashes", () => {
    const { plaintextCodes, hashedCodes } = generateBackupCodes();
    expect(plaintextCodes).toHaveLength(10);
    expect(hashedCodes).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(hashBackupCode(plaintextCodes[i])).toBe(hashedCodes[i]);
    }
  });

  it("generates unique codes", () => {
    const { plaintextCodes } = generateBackupCodes();
    const unique = new Set(plaintextCodes);
    expect(unique.size).toBe(10);
  });
});

describe("findBackupCodeMatch", () => {
  it("finds the index of a matching code (case-insensitive, trim)", () => {
    const { plaintextCodes, hashedCodes } = generateBackupCodes();
    expect(findBackupCodeMatch(plaintextCodes[3], hashedCodes)).toBe(3);
    expect(
      findBackupCodeMatch(plaintextCodes[3].toUpperCase(), hashedCodes)
    ).toBe(3);
    expect(findBackupCodeMatch(`  ${plaintextCodes[3]}  `, hashedCodes)).toBe(3);
  });

  it("returns -1 for an unknown code", () => {
    const { hashedCodes } = generateBackupCodes();
    expect(findBackupCodeMatch("00000000", hashedCodes)).toBe(-1);
  });
});
