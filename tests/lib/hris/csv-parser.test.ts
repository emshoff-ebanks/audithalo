import { describe, it, expect } from "vitest";
import {
  parseHrisCsv,
  validateSupervisorRefs,
} from "@/lib/hris/csv-parser";

describe("parseHrisCsv", () => {
  it("parses a minimal valid CSV", () => {
    const csv = `email,role\nalex@example.com,supervisee`;
    const out = parseHrisCsv(csv);
    expect(out.errors).toEqual([]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({
      email: "alex@example.com",
      role: "supervisee",
      name: null,
      primarySupervisorEmail: null,
    });
  });

  it("lowercases email and role", () => {
    const csv = `email,role\nALEX@EXAMPLE.COM,SUPERVISEE`;
    const out = parseHrisCsv(csv);
    expect(out.rows[0].email).toBe("alex@example.com");
    expect(out.rows[0].role).toBe("supervisee");
  });

  it("accepts header aliases (Supervisor Email, Employee ID)", () => {
    const csv = `Email Address,Role,Supervisor Email,Employee ID\nalex@example.com,supervisee,sandra@example.com,EMP-1`;
    const out = parseHrisCsv(csv);
    expect(out.errors).toEqual([]);
    expect(out.rows[0].primarySupervisorEmail).toBe("sandra@example.com");
    expect(out.rows[0].externalId).toBe("EMP-1");
  });

  it("flags missing required headers", () => {
    const csv = `name\nAlex Intern`;
    const out = parseHrisCsv(csv);
    const fields = out.errors.map((e) => e.field).sort();
    expect(fields).toEqual(["email", "role"]);
    expect(out.rows).toEqual([]);
  });

  it("rejects malformed email", () => {
    const csv = `email,role\nnot-an-email,supervisee`;
    const out = parseHrisCsv(csv);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].field).toBe("email");
    expect(out.rows).toEqual([]);
  });

  it("rejects unknown role", () => {
    const csv = `email,role\nalex@example.com,admin`;
    const out = parseHrisCsv(csv);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].field).toBe("role");
  });

  it("rejects supervisee-only fields on supervisor rows", () => {
    const csv = `email,role,primary_supervisor_email\nsandra@example.com,supervisor,boss@example.com`;
    const out = parseHrisCsv(csv);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].field).toBe("primary_supervisor_email");
  });

  it("rejects rule_id without obligation_started_at", () => {
    const csv = `email,role,rule_id\nalex@example.com,supervisee,nc-lcmhca-v1`;
    const out = parseHrisCsv(csv);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].field).toBe("obligation_started_at");
  });

  it("accepts rule_id + obligation_started_at together", () => {
    const csv = `email,role,rule_id,obligation_started_at\nalex@example.com,supervisee,nc-lcmhca-v1,2025-09-01`;
    const out = parseHrisCsv(csv);
    expect(out.errors).toEqual([]);
    expect(out.rows[0].ruleId).toBe("nc-lcmhca-v1");
    expect(out.rows[0].obligationStartedAt).toBe("2025-09-01");
  });

  it("rejects malformed dates", () => {
    const csv = `email,role,rule_id,obligation_started_at\nalex@example.com,supervisee,nc-lcmhca-v1,09/01/2025`;
    const out = parseHrisCsv(csv);
    expect(out.errors.some((e) => e.field === "obligation_started_at")).toBe(true);
  });

  it("detects duplicate emails within the CSV", () => {
    const csv = `email,role\nalex@example.com,supervisee\nalex@example.com,supervisor`;
    const out = parseHrisCsv(csv);
    expect(out.rows).toHaveLength(1);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].message).toMatch(/Duplicate/);
  });

  it("skips fully empty lines", () => {
    const csv = `email,role\nalex@example.com,supervisee\n\n\nsandra@example.com,supervisor`;
    const out = parseHrisCsv(csv);
    expect(out.errors).toEqual([]);
    expect(out.rows).toHaveLength(2);
  });

  it("reports unrecognized headers without rejecting the CSV", () => {
    const csv = `email,role,department\nalex@example.com,supervisee,clinical`;
    const out = parseHrisCsv(csv);
    expect(out.unrecognizedHeaders).toEqual(["department"]);
    expect(out.errors).toEqual([]);
    expect(out.rows).toHaveLength(1);
  });
});

describe("validateSupervisorRefs", () => {
  it("accepts when supervisor email matches an existing org supervisor", () => {
    const rows = [
      {
        rowNumber: 1,
        email: "alex@example.com",
        name: null,
        role: "supervisee" as const,
        primarySupervisorEmail: "sandra@example.com",
        ruleId: null,
        obligationStartedAt: null,
        externalId: null,
      },
    ];
    const errors = validateSupervisorRefs(
      rows,
      new Set(["sandra@example.com"])
    );
    expect(errors).toEqual([]);
  });

  it("accepts when supervisor is in the same CSV as a supervisor row", () => {
    const rows = [
      {
        rowNumber: 1,
        email: "sandra@example.com",
        name: null,
        role: "supervisor" as const,
        primarySupervisorEmail: null,
        ruleId: null,
        obligationStartedAt: null,
        externalId: null,
      },
      {
        rowNumber: 2,
        email: "alex@example.com",
        name: null,
        role: "supervisee" as const,
        primarySupervisorEmail: "sandra@example.com",
        ruleId: null,
        obligationStartedAt: null,
        externalId: null,
      },
    ];
    const errors = validateSupervisorRefs(rows, new Set());
    expect(errors).toEqual([]);
  });

  it("flags supervisor refs that aren't in the CSV or org", () => {
    const rows = [
      {
        rowNumber: 1,
        email: "alex@example.com",
        name: null,
        role: "supervisee" as const,
        primarySupervisorEmail: "ghost@example.com",
        ruleId: null,
        obligationStartedAt: null,
        externalId: null,
      },
    ];
    const errors = validateSupervisorRefs(rows, new Set());
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("primary_supervisor_email");
  });

  it("ignores supervisor refs on non-supervisee rows", () => {
    // (This shouldn't happen — parser blocks it — but defensive.)
    const rows = [
      {
        rowNumber: 1,
        email: "alex@example.com",
        name: null,
        role: "supervisor" as const,
        primarySupervisorEmail: "ghost@example.com",
        ruleId: null,
        obligationStartedAt: null,
        externalId: null,
      },
    ];
    const errors = validateSupervisorRefs(rows, new Set());
    expect(errors).toEqual([]);
  });
});
