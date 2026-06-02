import { describe, it, expect } from "vitest";
import { decideNextSignature } from "@/lib/signatures";
import type { SessionSignature } from "@/lib/db/schema";

const mkSig = (overrides: Partial<SessionSignature>): SessionSignature => ({
  signerId: "user-a",
  signerName: "User A",
  signerRole: "supervisee",
  signedAt: "2026-06-02T12:00:00.000Z",
  ipAddress: "10.0.0.1",
  intentConfirmed: true,
  ...overrides,
});

describe("decideNextSignature", () => {
  it("appends a new signature to an empty list and is NOT fully signed", () => {
    const result = decideNextSignature([], mkSig({}));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated).toHaveLength(1);
    expect(result.fullySigned).toBe(false);
  });

  it("marks fully signed once both supervisee and supervisor have signed", () => {
    const supervisee = mkSig({ signerId: "u1", signerRole: "supervisee" });
    const supervisor = mkSig({ signerId: "u2", signerRole: "supervisor" });
    const result = decideNextSignature([supervisee], supervisor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated).toHaveLength(2);
    expect(result.fullySigned).toBe(true);
  });

  it("rejects when the same signer tries to sign twice", () => {
    const first = mkSig({ signerId: "u1", signerRole: "supervisee" });
    const second = mkSig({ signerId: "u1", signerRole: "supervisee" });
    const result = decideNextSignature([first], second);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/already signed/i);
  });

  it("rejects when intent is not confirmed", () => {
    const result = decideNextSignature([], mkSig({ intentConfirmed: false }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/intent/i);
  });

  it("two supervisees alone do NOT mark fully signed (need a supervisor)", () => {
    const a = mkSig({ signerId: "u1", signerRole: "supervisee" });
    const b = mkSig({ signerId: "u2", signerRole: "supervisee" });
    const result = decideNextSignature([a], b);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fullySigned).toBe(false);
  });
});
