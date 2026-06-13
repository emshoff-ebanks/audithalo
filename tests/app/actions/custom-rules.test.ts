import { describe, it, expect, beforeEach, vi } from "vitest";

const AUTH_MOCK = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => AUTH_MOCK(),
}));

const GET_MEMBERSHIP_MOCK = vi.fn();
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: (...args: unknown[]) => GET_MEMBERSHIP_MOCK(...args),
  canManageOrg: (role: string | null | undefined) => role === "hr_admin",
}));

const SELECT_WHERE_MOCK = vi.fn().mockResolvedValue([]);
const SELECT_FROM_MOCK = vi.fn(() => ({ where: SELECT_WHERE_MOCK }));
const SELECT_MOCK = vi.fn(() => ({ from: SELECT_FROM_MOCK }));
const INSERT_RETURNING_MOCK = vi.fn(async () => [{ id: "inserted-id" }]);
const INSERT_VALUES_MOCK = vi.fn(() => ({ returning: INSERT_RETURNING_MOCK }));
const INSERT_MOCK = vi.fn(() => ({ values: INSERT_VALUES_MOCK }));

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => SELECT_MOCK(...args),
    insert: (...args: unknown[]) => INSERT_MOCK(...args),
  },
  schema: {
    orgRuleOverrides: {
      id: { name: "id" },
      orgId: { name: "org_id" },
      jurisdiction: { name: "jurisdiction" },
      licenseCode: { name: "license_code" },
      version: { name: "version" },
      canonicalRuleId: { name: "canonical_rule_id" },
      isActive: { name: "is_active" },
    },
  },
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    ORG_CUSTOM_RULE_CREATED: "org_custom_rule.created",
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createCustomRuleAction } from "@/app/actions/custom-rules";

const HR_ADMIN_SESSION = {
  user: { id: "user-1", email: "hr@example.test" },
};
const HR_ADMIN_MEMBERSHIP = { orgId: "org-1", role: "hr_admin" };

function asHrAdmin() {
  AUTH_MOCK.mockResolvedValue(HR_ADMIN_SESSION);
  GET_MEMBERSHIP_MOCK.mockResolvedValue(HR_ADMIN_MEMBERSHIP);
}

function validWyomingInput() {
  return {
    jurisdiction: "WY",
    licenseCode: "LPCA",
    label: "Wyoming LPCA — internal",
    licenseName: "Licensed Professional Counselor Associate",
    issuingBoard: "Wyoming Mental Health Professions Licensing Board",
    summary:
      "Wyoming LPCA candidates must accumulate supervised practice hours under a board-approved supervisor.",
    citationAdmincode: "WY ABC § 1.2.3",
    citationStatute: undefined,
    citationUrl: "https://board.wy.gov/admincode",
    structured: {
      total_practice_hours_required: 3000,
      total_supervision_hours_required: 100,
      min_duration_months: 24,
      max_duration_months: 60,
    },
    checks: [
      {
        templateKey: "total_hours" as const,
        subKind: "practice",
        severity: "info" as const,
        description: "Total practice hours",
        params: { required: 3000 },
      },
      {
        templateKey: "supervision_ratio" as const,
        subKind: "ratio_per_block",
        severity: "warning" as const,
        description: "Ratio",
        params: {
          practice_hours_per_block: 40,
          individual_hours_required: 1,
          group_hours_required: 2,
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  SELECT_WHERE_MOCK.mockResolvedValue([]);
});

describe("createCustomRuleAction — authz", () => {
  it("rejects unauthenticated callers", async () => {
    AUTH_MOCK.mockResolvedValue(null);
    const r = await createCustomRuleAction(validWyomingInput());
    expect(r).toEqual({ ok: false, error: "Not authenticated." });
  });

  it("rejects non-HR-Admin callers", async () => {
    AUTH_MOCK.mockResolvedValue(HR_ADMIN_SESSION);
    GET_MEMBERSHIP_MOCK.mockResolvedValue({
      orgId: "org-1",
      role: "supervisor",
    });
    const r = await createCustomRuleAction(validWyomingInput());
    expect(r).toEqual({
      ok: false,
      error: "Only HR Admins can create custom rules.",
    });
  });
});

describe("createCustomRuleAction — canonical-collision guard", () => {
  beforeEach(() => asHrAdmin());

  it("rejects creating a custom rule for a jurisdiction with a canonical", async () => {
    // NC LCMHCA v1 exists as a canonical YAML.
    const input = {
      ...validWyomingInput(),
      jurisdiction: "NC",
      licenseCode: "LCMHCA",
    };
    const r = await createCustomRuleAction(input);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/canonical rule already exists/i);
    expect(INSERT_MOCK).not.toHaveBeenCalled();
  });
});

describe("createCustomRuleAction — template validation", () => {
  beforeEach(() => asHrAdmin());

  it("inserts and returns the synthetic rule id on a valid payload", async () => {
    const r = await createCustomRuleAction(validWyomingInput());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruleId).toBe("org:org-1:custom:wy-lpca-v1");
    }
    expect(INSERT_MOCK).toHaveBeenCalledOnce();
  });

  it("rejects an unknown template key (Zod enum guard)", async () => {
    const input = validWyomingInput();
    const r = await createCustomRuleAction({
      ...input,
      checks: [
        {
          ...input.checks[0],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          templateKey: "not_a_template" as any,
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(INSERT_MOCK).not.toHaveBeenCalled();
  });

  it("rejects an unknown sub-kind", async () => {
    const input = validWyomingInput();
    const r = await createCustomRuleAction({
      ...input,
      checks: [
        {
          templateKey: "total_hours",
          subKind: "not_a_subkind",
          severity: "info",
          description: "",
          params: { required: 100 },
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/sub-kind/);
    expect(INSERT_MOCK).not.toHaveBeenCalled();
  });

  it("rejects duplicate evaluator IDs across checks", async () => {
    const input = validWyomingInput();
    const r = await createCustomRuleAction({
      ...input,
      checks: [
        {
          templateKey: "total_hours",
          subKind: "practice",
          severity: "info",
          description: "",
          params: { required: 3000 },
        },
        {
          templateKey: "total_hours",
          subKind: "practice",
          severity: "info",
          description: "",
          params: { required: 3500 },
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/Duplicate check/);
    expect(INSERT_MOCK).not.toHaveBeenCalled();
  });

  it("rejects zero-hour totals via canonical Zod validation", async () => {
    const input = validWyomingInput();
    const r = await createCustomRuleAction({
      ...input,
      structured: {
        ...input.structured,
        total_supervision_hours_required: 0,
      },
    });
    expect(r.ok).toBe(false);
    expect(INSERT_MOCK).not.toHaveBeenCalled();
  });

  it("requires a citation URL", async () => {
    const input = validWyomingInput();
    const r = await createCustomRuleAction({
      ...input,
      citationUrl: "not-a-url",
    });
    expect(r.ok).toBe(false);
    expect(INSERT_MOCK).not.toHaveBeenCalled();
  });

  it("bumps version above prior org rows for the same (jurisdiction, license)", async () => {
    SELECT_WHERE_MOCK.mockResolvedValue([
      { version: 1 },
      { version: 2 },
    ]);
    const r = await createCustomRuleAction(validWyomingInput());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruleId).toBe("org:org-1:custom:wy-lpca-v3");
    }
  });
});
