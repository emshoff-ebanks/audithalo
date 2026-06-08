import { describe, it, expect, vi } from "vitest";

// `@/lib/authz` re-exports helpers backed by `@/auth`, which pulls in next-auth
// at module load. Stub it so the pure role-check helpers can be loaded without
// dragging the auth runtime into the test environment.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import {
  isManagerRole,
  canSupervise,
  isOrgOwner,
  isHrAdmin,
  isExecutive,
  canViewWholeOrg,
  canManageOrg,
  canExportAuditLog,
} from "@/lib/authz";

describe("isManagerRole", () => {
  // Manager-tier = supervisor, hr_admin, executive (Enterprise tier, 0023).
  // Supervisee never gets manager access.
  it("returns true for supervisor", () => {
    expect(isManagerRole("supervisor")).toBe(true);
  });
  it("returns true for hr_admin", () => {
    expect(isManagerRole("hr_admin")).toBe(true);
  });
  it("returns true for executive", () => {
    expect(isManagerRole("executive")).toBe(true);
  });
  it("returns false for supervisee", () => {
    expect(isManagerRole("supervisee")).toBe(false);
  });
  it("returns false for null/undefined", () => {
    expect(isManagerRole(null)).toBe(false);
    expect(isManagerRole(undefined)).toBe(false);
  });
  it("returns false for unknown roles (defense)", () => {
    expect(isManagerRole("admin")).toBe(false);
  });
});

describe("canSupervise", () => {
  // Clinical signing permission. ONLY supervisors — the clinical/admin
  // firewall is intentional. HR Admin and Executive are admin/oversight
  // roles; they MUST NOT be able to sign supervision sessions.
  it("returns true ONLY for supervisor", () => {
    expect(canSupervise("supervisor")).toBe(true);
  });
  it("returns false for hr_admin (clinical firewall)", () => {
    expect(canSupervise("hr_admin")).toBe(false);
  });
  it("returns false for executive (clinical firewall)", () => {
    expect(canSupervise("executive")).toBe(false);
  });
  it("returns false for supervisee", () => {
    expect(canSupervise("supervisee")).toBe(false);
  });
  it("returns false for null/undefined", () => {
    expect(canSupervise(null)).toBe(false);
    expect(canSupervise(undefined)).toBe(false);
  });
});

describe("isHrAdmin", () => {
  it("returns true only for hr_admin", () => {
    expect(isHrAdmin("hr_admin")).toBe(true);
    expect(isHrAdmin("supervisor")).toBe(false);
    expect(isHrAdmin("executive")).toBe(false);
    expect(isHrAdmin("supervisee")).toBe(false);
    expect(isHrAdmin(null)).toBe(false);
  });
});

describe("isExecutive", () => {
  it("returns true only for executive", () => {
    expect(isExecutive("executive")).toBe(true);
    expect(isExecutive("supervisor")).toBe(false);
    expect(isExecutive("hr_admin")).toBe(false);
    expect(isExecutive("supervisee")).toBe(false);
    expect(isExecutive(null)).toBe(false);
  });
});

describe("canViewWholeOrg", () => {
  // Org-wide read = HR Admin + Executive. Supervisor only sees their own
  // roster; Supervisee only sees themselves.
  it("returns true for hr_admin and executive", () => {
    expect(canViewWholeOrg("hr_admin")).toBe(true);
    expect(canViewWholeOrg("executive")).toBe(true);
  });
  it("returns false for supervisor and supervisee", () => {
    expect(canViewWholeOrg("supervisor")).toBe(false);
    expect(canViewWholeOrg("supervisee")).toBe(false);
  });
});

describe("canManageOrg", () => {
  // Org write = HR Admin only. Supervisors can run their own roster but
  // cannot invite other supervisors, change org settings, etc.
  it("returns true only for hr_admin", () => {
    expect(canManageOrg("hr_admin")).toBe(true);
    expect(canManageOrg("supervisor")).toBe(false);
    expect(canManageOrg("executive")).toBe(false);
    expect(canManageOrg("supervisee")).toBe(false);
  });
});

describe("canExportAuditLog", () => {
  // Audit log export = HR Admin (full) + Executive (read-only).
  // Supervisor + Supervisee see their own actions only via the audit log
  // page but can't export org-wide.
  it("returns true for hr_admin and executive", () => {
    expect(canExportAuditLog("hr_admin")).toBe(true);
    expect(canExportAuditLog("executive")).toBe(true);
  });
  it("returns false for supervisor and supervisee", () => {
    expect(canExportAuditLog("supervisor")).toBe(false);
    expect(canExportAuditLog("supervisee")).toBe(false);
  });
});

describe("isOrgOwner", () => {
  it("returns true when userId matches org.createdById", () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    expect(isOrgOwner(userId, { createdById: userId })).toBe(true);
  });
  it("returns false when userId does not match org.createdById", () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const otherId = "22222222-2222-2222-2222-222222222222";
    expect(isOrgOwner(userId, { createdById: otherId })).toBe(false);
  });
});
