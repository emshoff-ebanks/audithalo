import { describe, it, expect, vi } from "vitest";

// `@/lib/authz` re-exports helpers backed by `@/auth`, which pulls in next-auth
// at module load. Stub it so the pure role-check helpers can be loaded without
// dragging the auth runtime into the test environment.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { isManagerRole, canSupervise } from "@/lib/authz";

describe("isManagerRole", () => {
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
  it("returns true ONLY for supervisor", () => {
    expect(canSupervise("supervisor")).toBe(true);
  });
  it("returns false for hr_admin (read-only management role)", () => {
    expect(canSupervise("hr_admin")).toBe(false);
  });
  it("returns false for executive (read-only management role)", () => {
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
