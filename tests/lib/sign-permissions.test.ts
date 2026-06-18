import { describe, it, expect } from "vitest";
import {
  signPermissions,
  type SignPermissionContext,
} from "@/lib/sign-permissions";

function ctx(overrides: Partial<SignPermissionContext> = {}): SignPermissionContext {
  return {
    role: "supervisor",
    isSelfSupervisee: false,
    isOriginalLogger: false,
    isAssignedSupervisor: false,
    ...overrides,
  };
}

describe("signPermissions — supervisee on own row", () => {
  const base = ctx({ role: "supervisee", isSelfSupervisee: true });

  it("can sign and mark no-show, cannot cancel/reschedule/AI-note", () => {
    expect(signPermissions(base)).toEqual({
      canCancel: false,
      canReschedule: false,
      canMarkNoShow: true,
      canSign: true,
      canGenerateAiNote: false,
    });
  });

  it("supervisee who originally scheduled it gets cancel + reschedule too", () => {
    const p = signPermissions({ ...base, isOriginalLogger: true });
    expect(p.canCancel).toBe(true);
    expect(p.canReschedule).toBe(true);
    expect(p.canMarkNoShow).toBe(true);
    expect(p.canSign).toBe(true);
    // Supervisees don't author AI notes even when they logged the row.
    expect(p.canGenerateAiNote).toBe(false);
  });
});

describe("signPermissions — assigned supervisor", () => {
  const base = ctx({
    role: "supervisor",
    isAssignedSupervisor: true,
  });

  it("can do everything (sign, cancel, reschedule, no-show, AI-note)", () => {
    expect(signPermissions(base)).toEqual({
      canCancel: true,
      canReschedule: true,
      canMarkNoShow: true,
      canSign: true,
      canGenerateAiNote: true,
    });
  });

  it("also works when they were the original scheduler", () => {
    expect(
      signPermissions({ ...base, isOriginalLogger: true })
    ).toMatchObject({
      canCancel: true,
      canSign: true,
      canGenerateAiNote: true,
    });
  });
});

describe("signPermissions — peer supervisor (not assigned, not logger)", () => {
  const base = ctx({ role: "supervisor" });

  it("blocks everything — they have view-only access", () => {
    expect(signPermissions(base)).toEqual({
      canCancel: false,
      canReschedule: false,
      canMarkNoShow: false,
      canSign: false,
      canGenerateAiNote: false,
    });
  });

  it("becomes original-logger eligible if they previously scheduled", () => {
    // Atlas demo case: a supervisor scheduled a session for a supervisee
    // who was later reassigned to a peer. Original-logger affordances
    // stay with the scheduler — matches server-side authz.
    const p = signPermissions({ ...base, isOriginalLogger: true });
    expect(p.canCancel).toBe(true);
    expect(p.canReschedule).toBe(true);
    expect(p.canMarkNoShow).toBe(true);
    expect(p.canSign).toBe(true);
    expect(p.canGenerateAiNote).toBe(true);
  });
});

describe("signPermissions — HR Admin", () => {
  const base = ctx({ role: "hr_admin" });

  it("can cancel/reschedule/no-show org-wide; cannot sign or AI-note", () => {
    expect(signPermissions(base)).toEqual({
      canCancel: true,
      canReschedule: true,
      canMarkNoShow: true,
      canSign: false,
      canGenerateAiNote: false,
    });
  });

  it("still can't sign or AI-note even if they were the logger", () => {
    const p = signPermissions({ ...base, isOriginalLogger: true });
    expect(p.canSign).toBe(false);
    expect(p.canGenerateAiNote).toBe(false);
  });
});

describe("signPermissions — executive", () => {
  it("view-only — no affordances at all", () => {
    expect(signPermissions(ctx({ role: "executive" }))).toEqual({
      canCancel: false,
      canReschedule: false,
      canMarkNoShow: false,
      canSign: false,
      canGenerateAiNote: false,
    });
  });
});

describe("signPermissions — defensive defaults", () => {
  it("null role grants nothing", () => {
    expect(signPermissions(ctx({ role: null }))).toEqual({
      canCancel: false,
      canReschedule: false,
      canMarkNoShow: false,
      canSign: false,
      canGenerateAiNote: false,
    });
  });

  it("undefined role grants nothing", () => {
    expect(signPermissions(ctx({ role: undefined }))).toEqual({
      canCancel: false,
      canReschedule: false,
      canMarkNoShow: false,
      canSign: false,
      canGenerateAiNote: false,
    });
  });

  it("unknown role string grants nothing", () => {
    expect(signPermissions(ctx({ role: "auditor" }))).toEqual({
      canCancel: false,
      canReschedule: false,
      canMarkNoShow: false,
      canSign: false,
      canGenerateAiNote: false,
    });
  });
});
