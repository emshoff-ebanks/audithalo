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
  it("appends a supervisor signature to an empty list and is NOT fully signed", () => {
    const result = decideNextSignature(
      [],
      mkSig({ signerRole: "supervisor" })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated).toHaveLength(1);
    expect(result.fullySigned).toBe(false);
  });

  it("marks fully signed once supervisor signs first, then supervisee countersigns", () => {
    const supervisor = mkSig({ signerId: "u2", signerRole: "supervisor" });
    const supervisee = mkSig({ signerId: "u1", signerRole: "supervisee" });
    const result = decideNextSignature([supervisor], supervisee);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated).toHaveLength(2);
    expect(result.fullySigned).toBe(true);
  });

  it("rejects when the same signer tries to sign twice", () => {
    const first = mkSig({ signerId: "u1", signerRole: "supervisor" });
    const second = mkSig({ signerId: "u1", signerRole: "supervisor" });
    const result = decideNextSignature([first], second);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/already signed/i);
  });

  it("rejects when intent is not confirmed", () => {
    const result = decideNextSignature(
      [],
      mkSig({ intentConfirmed: false, signerRole: "supervisor" })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/intent/i);
  });

  // --- Signing order enforcement ---

  it("rejects supervisee signing on an empty list (supervisor must sign first)", () => {
    const result = decideNextSignature(
      [],
      mkSig({ signerId: "u1", signerRole: "supervisee" })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/supervisor must sign/i);
  });

  it("rejects supervisee signing when only another supervisee has signed (no supervisor yet)", () => {
    const otherSupervisee = mkSig({
      signerId: "u3",
      signerRole: "supervisee",
    });
    const result = decideNextSignature(
      [otherSupervisee],
      mkSig({ signerId: "u1", signerRole: "supervisee" })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/supervisor must sign/i);
  });

  it("allows supervisee to sign after supervisor has signed", () => {
    const supervisor = mkSig({ signerId: "u2", signerRole: "supervisor" });
    const result = decideNextSignature(
      [supervisor],
      mkSig({ signerId: "u1", signerRole: "supervisee" })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated).toHaveLength(2);
    expect(result.fullySigned).toBe(true);
  });

  it("allows supervisor to sign on an empty list", () => {
    const result = decideNextSignature(
      [],
      mkSig({ signerId: "u2", signerRole: "supervisor" })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated).toHaveLength(1);
    expect(result.fullySigned).toBe(false);
  });

  it("group session: multiple supervisees can sign after supervisor", () => {
    const supervisor = mkSig({ signerId: "u1", signerRole: "supervisor" });
    const superviseeA = mkSig({ signerId: "u2", signerRole: "supervisee" });
    // First supervisee signs after supervisor
    const r1 = decideNextSignature([supervisor], superviseeA);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    // Second supervisee signs after both
    const superviseeB = mkSig({ signerId: "u3", signerRole: "supervisee" });
    const r2 = decideNextSignature(r1.updated, superviseeB);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.updated).toHaveLength(3);
  });
});
