import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks. The action imports @/auth, @/lib/db, @/lib/authz, @/lib/audit-log —
// none of which we can resolve in the vitest runner (no DATABASE_URL, no
// AUTH_SECRET). We stub them with the smallest surface the action touches.
// ---------------------------------------------------------------------------

const AUTH_MOCK = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => AUTH_MOCK(),
}));

const GET_MEMBERSHIP_MOCK = vi.fn();
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: (...args: unknown[]) => GET_MEMBERSHIP_MOCK(...args),
  canManageOrg: (role: string | null | undefined) => role === "hr_admin",
}));

// findFirst returns the "existing" override row (or undefined for create).
const FIND_FIRST_MOCK = vi.fn();
const ASSIGNMENT_FIND_FIRST_MOCK = vi.fn();
const UPDATE_WHERE_MOCK = vi.fn().mockResolvedValue(undefined);
const UPDATE_SET_MOCK = vi.fn(() => ({ where: UPDATE_WHERE_MOCK }));
const UPDATE_MOCK = vi.fn(() => ({ set: UPDATE_SET_MOCK }));
const INSERT_RETURNING_MOCK = vi.fn(async () => [{ id: "inserted-id" }]);
const INSERT_VALUES_MOCK = vi.fn(() => ({ returning: INSERT_RETURNING_MOCK }));
const INSERT_MOCK = vi.fn(() => ({ values: INSERT_VALUES_MOCK }));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      orgRuleOverrides: {
        findFirst: (...args: unknown[]) => FIND_FIRST_MOCK(...args),
      },
      superviseeRuleAssignments: {
        findFirst: (...args: unknown[]) =>
          ASSIGNMENT_FIND_FIRST_MOCK(...args),
      },
    },
    update: (...args: unknown[]) => UPDATE_MOCK(...args),
    insert: (...args: unknown[]) => INSERT_MOCK(...args),
  },
  schema: {
    orgRuleOverrides: {
      id: { name: "id" },
      orgId: { name: "org_id" },
      canonicalRuleId: { name: "canonical_rule_id" },
      isActive: { name: "is_active" },
    },
    superviseeRuleAssignments: {
      orgId: { name: "org_id" },
      ruleId: { name: "rule_id" },
    },
  },
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    ORG_RULE_OVERRIDE_UPSERTED: "org_rule_override.upserted",
    ORG_RULE_OVERRIDE_DEACTIVATED: "org_rule_override.deactivated",
    ORG_CUSTOM_RULE_DEACTIVATED: "org_custom_rule.deactivated",
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  deactivateOverrideAction,
  upsertCanonicalOverrideAction,
} from "@/app/actions/rule-overrides";

const HR_ADMIN_SESSION = { user: { id: "user-1" } };
const HR_ADMIN_MEMBERSHIP = { orgId: "org-1", role: "hr_admin" };

function asHrAdmin() {
  AUTH_MOCK.mockResolvedValue(HR_ADMIN_SESSION);
  GET_MEMBERSHIP_MOCK.mockResolvedValue(HR_ADMIN_MEMBERSHIP);
}

beforeEach(() => {
  vi.clearAllMocks();
  FIND_FIRST_MOCK.mockResolvedValue(undefined);
  ASSIGNMENT_FIND_FIRST_MOCK.mockResolvedValue(undefined);
});

describe("upsertCanonicalOverrideAction — authz", () => {
  it("rejects when not signed in", async () => {
    AUTH_MOCK.mockResolvedValue(null);
    const r = await upsertCanonicalOverrideAction({
      canonicalRuleId: "nc-lcmhca-v1",
      label: "test",
      structuredPatch: {},
      severityChanges: {},
      removeChecks: [],
      expectedUpdatedAt: null,
    });
    expect(r).toEqual({ ok: false, error: "Not authenticated." });
  });

  it("rejects when caller is not an HR Admin", async () => {
    AUTH_MOCK.mockResolvedValue(HR_ADMIN_SESSION);
    GET_MEMBERSHIP_MOCK.mockResolvedValue({ orgId: "org-1", role: "supervisor" });
    const r = await upsertCanonicalOverrideAction({
      canonicalRuleId: "nc-lcmhca-v1",
      label: "test",
      structuredPatch: {},
      severityChanges: {},
      removeChecks: [],
      expectedUpdatedAt: null,
    });
    expect(r).toEqual({
      ok: false,
      error: "Only HR Admins can edit rule overrides.",
    });
  });
});

describe("upsertCanonicalOverrideAction — severity downgrade-only", () => {
  beforeEach(() => asHrAdmin());

  it("rejects strengthening a warning to a blocker", async () => {
    // Pull a real warning-severity check id from the NC rule so the test
    // exercises the actual SEVERITY_RANK comparison against the canonical.
    const { getRule } = await import("@/lib/rules/loader");
    const canonical = getRule("NC", "LCMHCA", 1);
    const warning = canonical.checks.find((c) => c.severity === "warning");
    expect(warning, "test fixture: NC LCMHCA v1 has a warning check").toBeDefined();

    const r = await upsertCanonicalOverrideAction({
      canonicalRuleId: "nc-lcmhca-v1",
      label: "test",
      structuredPatch: {},
      severityChanges: { [warning!.id]: "blocker" },
      removeChecks: [],
      expectedUpdatedAt: null,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/loosened/i);
    expect(UPDATE_MOCK).not.toHaveBeenCalled();
    expect(INSERT_MOCK).not.toHaveBeenCalled();
  });

  it("accepts downgrading a blocker to a warning", async () => {
    const { getRule } = await import("@/lib/rules/loader");
    const canonical = getRule("NC", "LCMHCA", 1);
    const blocker = canonical.checks.find((c) => c.severity === "blocker");
    expect(blocker, "test fixture: NC LCMHCA v1 has a blocker check").toBeDefined();

    const r = await upsertCanonicalOverrideAction({
      canonicalRuleId: "nc-lcmhca-v1",
      label: "test",
      structuredPatch: {},
      severityChanges: { [blocker!.id]: "warning" },
      removeChecks: [],
      expectedUpdatedAt: null,
    });
    expect(r).toEqual({ ok: true });
    expect(INSERT_MOCK).toHaveBeenCalledOnce();
  });

  it("rejects severityChanges that reference unknown check ids", async () => {
    const r = await upsertCanonicalOverrideAction({
      canonicalRuleId: "nc-lcmhca-v1",
      label: "test",
      structuredPatch: {},
      severityChanges: { not_a_real_check: "warning" },
      removeChecks: [],
      expectedUpdatedAt: null,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/not_a_real_check/);
  });

  it("rejects removeChecks that reference unknown check ids", async () => {
    const r = await upsertCanonicalOverrideAction({
      canonicalRuleId: "nc-lcmhca-v1",
      label: "test",
      structuredPatch: {},
      severityChanges: {},
      removeChecks: ["not_a_real_check"],
      expectedUpdatedAt: null,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/not_a_real_check/);
  });
});

describe("upsertCanonicalOverrideAction — optimistic concurrency", () => {
  beforeEach(() => asHrAdmin());

  it("returns conflict: 'stale_row' when expectedUpdatedAt is behind the row", async () => {
    const dbUpdatedAt = new Date("2026-06-10T10:00:00.000Z");
    FIND_FIRST_MOCK.mockResolvedValue({
      id: "existing-1",
      orgId: "org-1",
      canonicalRuleId: "nc-lcmhca-v1",
      updatedAt: dbUpdatedAt,
      isActive: true,
    });

    const r = await upsertCanonicalOverrideAction({
      canonicalRuleId: "nc-lcmhca-v1",
      label: "test",
      structuredPatch: {},
      severityChanges: {},
      removeChecks: [],
      // form was rendered with an older timestamp — co-admin saved since
      expectedUpdatedAt: "2026-06-09T09:00:00.000Z",
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && "conflict" in r && r.conflict).toBe("stale_row");
    expect(UPDATE_MOCK).not.toHaveBeenCalled();
  });

  it("updates the existing row when expectedUpdatedAt matches", async () => {
    const dbUpdatedAt = new Date("2026-06-10T10:00:00.000Z");
    FIND_FIRST_MOCK.mockResolvedValue({
      id: "existing-1",
      orgId: "org-1",
      canonicalRuleId: "nc-lcmhca-v1",
      updatedAt: dbUpdatedAt,
      isActive: true,
    });

    const r = await upsertCanonicalOverrideAction({
      canonicalRuleId: "nc-lcmhca-v1",
      label: "test",
      structuredPatch: {},
      severityChanges: {},
      removeChecks: [],
      expectedUpdatedAt: dbUpdatedAt.toISOString(),
    });

    expect(r).toEqual({ ok: true });
    expect(UPDATE_MOCK).toHaveBeenCalledOnce();
    expect(INSERT_MOCK).not.toHaveBeenCalled();
  });

  it("inserts when no existing row regardless of expectedUpdatedAt", async () => {
    FIND_FIRST_MOCK.mockResolvedValue(undefined);

    const r = await upsertCanonicalOverrideAction({
      canonicalRuleId: "nc-lcmhca-v1",
      label: "test",
      structuredPatch: {},
      severityChanges: {},
      removeChecks: [],
      expectedUpdatedAt: null,
    });

    expect(r).toEqual({ ok: true });
    expect(INSERT_MOCK).toHaveBeenCalledOnce();
  });
});

describe("upsertCanonicalOverrideAction — invalid canonical rule id", () => {
  beforeEach(() => asHrAdmin());

  it("rejects an unparseable rule id", async () => {
    const r = await upsertCanonicalOverrideAction({
      canonicalRuleId: "not-a-rule-id",
      label: "test",
      structuredPatch: {},
      severityChanges: {},
      removeChecks: [],
      expectedUpdatedAt: null,
    });
    expect(r).toEqual({ ok: false, error: "Unknown canonical rule id." });
  });

  it("rejects a rule id that parses but isn't in the registry", async () => {
    const r = await upsertCanonicalOverrideAction({
      canonicalRuleId: "zz-fake-v9",
      label: "test",
      structuredPatch: {},
      severityChanges: {},
      removeChecks: [],
      expectedUpdatedAt: null,
    });
    expect(r).toEqual({ ok: false, error: "Canonical rule no longer exists." });
  });
});

describe("deactivateOverrideAction", () => {
  const VALID_UUID = "11111111-1111-4111-8111-111111111111";

  it("rejects unauthenticated callers", async () => {
    AUTH_MOCK.mockResolvedValue(null);
    const r = await deactivateOverrideAction({ overrideId: VALID_UUID });
    expect(r).toEqual({ ok: false, error: "Not authenticated." });
  });

  it("rejects non-HR-Admin callers", async () => {
    AUTH_MOCK.mockResolvedValue(HR_ADMIN_SESSION);
    GET_MEMBERSHIP_MOCK.mockResolvedValue({
      orgId: "org-1",
      role: "supervisor",
    });
    const r = await deactivateOverrideAction({ overrideId: VALID_UUID });
    expect(r).toEqual({
      ok: false,
      error: "Only HR Admins can deactivate rule overrides.",
    });
  });

  it("rejects a row that doesn't belong to the org", async () => {
    asHrAdmin();
    FIND_FIRST_MOCK.mockResolvedValue(undefined);
    const r = await deactivateOverrideAction({ overrideId: VALID_UUID });
    expect(r).toEqual({ ok: false, error: "Override not found." });
    expect(UPDATE_MOCK).not.toHaveBeenCalled();
  });

  it("rejects a row that's already inactive", async () => {
    asHrAdmin();
    FIND_FIRST_MOCK.mockResolvedValue({
      id: VALID_UUID,
      orgId: "org-1",
      canonicalRuleId: "nc-lcmhca-v1",
      jurisdiction: "NC",
      licenseCode: "LCMHCA",
      version: 1,
      isActive: false,
    });
    const r = await deactivateOverrideAction({ overrideId: VALID_UUID });
    expect(r).toEqual({ ok: false, error: "Already inactive." });
    expect(UPDATE_MOCK).not.toHaveBeenCalled();
  });

  it("deactivates a canonical override row successfully", async () => {
    asHrAdmin();
    FIND_FIRST_MOCK.mockResolvedValue({
      id: VALID_UUID,
      orgId: "org-1",
      canonicalRuleId: "nc-lcmhca-v1",
      jurisdiction: "NC",
      licenseCode: "LCMHCA",
      version: 1,
      isActive: true,
    });
    const r = await deactivateOverrideAction({ overrideId: VALID_UUID });
    expect(r).toEqual({ ok: true });
    expect(UPDATE_MOCK).toHaveBeenCalledOnce();
    expect(UPDATE_SET_MOCK).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false })
    );
  });

  it("refuses to deactivate a custom rule when assignments still point at it", async () => {
    asHrAdmin();
    FIND_FIRST_MOCK.mockResolvedValue({
      id: VALID_UUID,
      orgId: "org-1",
      canonicalRuleId: null,
      jurisdiction: "WY",
      licenseCode: "LPCA",
      version: 1,
      isActive: true,
    });
    ASSIGNMENT_FIND_FIRST_MOCK.mockResolvedValue({
      id: "assignment-1",
      orgId: "org-1",
      ruleId: "org:org-1:custom:wy-lpca-v1",
    });
    const r = await deactivateOverrideAction({ overrideId: VALID_UUID });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/still assigned/i);
    expect(UPDATE_MOCK).not.toHaveBeenCalled();
  });

  it("deactivates a custom rule with no remaining assignments", async () => {
    asHrAdmin();
    FIND_FIRST_MOCK.mockResolvedValue({
      id: VALID_UUID,
      orgId: "org-1",
      canonicalRuleId: null,
      jurisdiction: "WY",
      licenseCode: "LPCA",
      version: 1,
      isActive: true,
    });
    ASSIGNMENT_FIND_FIRST_MOCK.mockResolvedValue(undefined);
    const r = await deactivateOverrideAction({ overrideId: VALID_UUID });
    expect(r).toEqual({ ok: true });
    expect(UPDATE_MOCK).toHaveBeenCalledOnce();
  });
});
