import Papa from "papaparse";

/**
 * Pure CSV parsing + per-row validation for the HRIS import flow. No DB I/O
 * here — the action layer does seat-cap checks, duplicate detection, and
 * row insertion. This module's job is "is the CSV well-formed and does
 * each row pass field-level validation."
 *
 * Supported columns (case-insensitive header, snake_case canonical):
 *   - email                       (required, valid email)
 *   - name                        (optional, max 200 chars)
 *   - role                        (required: "supervisee" | "supervisor"
 *                                  | "hr_admin" | "executive")
 *   - primary_supervisor_email    (optional, supervisee-only)
 *   - rule_id                     (optional, supervisee-only; e.g. "nc-lcmhca-v1")
 *   - obligation_started_at       (optional, supervisee-only; YYYY-MM-DD)
 *   - external_id                 (optional; HRIS employee id for cross-system
 *                                  correlation — stored in invitation.details)
 */

const ALLOWED_ROLES = new Set([
  "supervisee",
  "supervisor",
  "hr_admin",
  "executive",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const HEADER_ALIASES: Record<string, string> = {
  // canonical → canonical
  email: "email",
  name: "name",
  role: "role",
  primary_supervisor_email: "primary_supervisor_email",
  rule_id: "rule_id",
  obligation_started_at: "obligation_started_at",
  external_id: "external_id",
  // common aliases HR systems emit
  "e-mail": "email",
  "email address": "email",
  "full name": "name",
  "display name": "name",
  "supervisor email": "primary_supervisor_email",
  "supervisor": "primary_supervisor_email",
  "employee id": "external_id",
  "employee_id": "external_id",
};

export type ImportRole = "supervisee" | "supervisor" | "hr_admin" | "executive";

export type ParsedRow = {
  /** 1-indexed row number in the CSV (after header). */
  rowNumber: number;
  email: string;
  name: string | null;
  role: ImportRole;
  primarySupervisorEmail: string | null;
  ruleId: string | null;
  obligationStartedAt: string | null;
  externalId: string | null;
};

export type RowError = {
  rowNumber: number;
  field: string;
  message: string;
};

export type ParseOutcome = {
  /** Headers as they appeared in the CSV (lowercased). */
  rawHeaders: string[];
  /** Headers we couldn't map to a known column — warn the user but don't reject. */
  unrecognizedHeaders: string[];
  /** Successfully parsed rows. May still fail downstream (duplicates, seat caps). */
  rows: ParsedRow[];
  /** Field-level errors. Rows in `rows` exclude error rows; the action should
   *  refuse to commit if any errors are present. */
  errors: RowError[];
};

const REQUIRED_HEADERS = ["email", "role"];

/** Parse CSV text. Pure — no I/O, no exceptions for malformed CSV. */
export function parseHrisCsv(text: string): ParseOutcome {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const rawHeaders = parsed.meta.fields ?? [];
  const canonicalByRaw = new Map<string, string>();
  const unrecognizedHeaders: string[] = [];
  for (const h of rawHeaders) {
    const canonical = HEADER_ALIASES[h];
    if (canonical) {
      canonicalByRaw.set(h, canonical);
    } else {
      unrecognizedHeaders.push(h);
    }
  }

  const errors: RowError[] = [];

  // Missing required headers — fail-fast with one error per missing header on row 0.
  for (const required of REQUIRED_HEADERS) {
    const found = rawHeaders.some((h) => HEADER_ALIASES[h] === required);
    if (!found) {
      errors.push({
        rowNumber: 0,
        field: required,
        message: `Missing required column "${required}".`,
      });
    }
  }

  if (errors.length > 0) {
    return { rawHeaders, unrecognizedHeaders, rows: [], errors };
  }

  const rows: ParsedRow[] = [];
  const seenEmails = new Set<string>();

  parsed.data.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    // Map raw → canonical.
    const get = (canonical: string): string => {
      for (const [r, c] of canonicalByRaw) {
        if (c === canonical) return (raw[r] ?? "").trim();
      }
      return "";
    };

    const email = get("email").toLowerCase();
    const role = get("role").toLowerCase();
    const name = get("name");
    const supEmail = get("primary_supervisor_email").toLowerCase();
    const ruleId = get("rule_id").toLowerCase();
    const obligation = get("obligation_started_at");
    const externalId = get("external_id");

    // email
    if (!email) {
      errors.push({ rowNumber, field: "email", message: "Email is required." });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({
        rowNumber,
        field: "email",
        message: `"${email}" is not a valid email address.`,
      });
      return;
    }
    if (seenEmails.has(email)) {
      errors.push({
        rowNumber,
        field: "email",
        message: `Duplicate email in CSV: ${email}.`,
      });
      return;
    }
    seenEmails.add(email);

    // role
    if (!role) {
      errors.push({ rowNumber, field: "role", message: "Role is required." });
      return;
    }
    if (!ALLOWED_ROLES.has(role)) {
      errors.push({
        rowNumber,
        field: "role",
        message: `"${role}" is not a valid role. Use one of: supervisee, supervisor, hr_admin, executive.`,
      });
      return;
    }
    const typedRole = role as ImportRole;

    // supervisee-only fields on non-supervisee rows: warn-shaped error so the
    // user doesn't accidentally rely on fields that won't apply.
    if (typedRole !== "supervisee") {
      if (supEmail) {
        errors.push({
          rowNumber,
          field: "primary_supervisor_email",
          message: `primary_supervisor_email only applies to supervisee rows; remove it from this ${role} row.`,
        });
        return;
      }
      if (ruleId) {
        errors.push({
          rowNumber,
          field: "rule_id",
          message: `rule_id only applies to supervisee rows; remove it from this ${role} row.`,
        });
        return;
      }
      if (obligation) {
        errors.push({
          rowNumber,
          field: "obligation_started_at",
          message: `obligation_started_at only applies to supervisee rows; remove it from this ${role} row.`,
        });
        return;
      }
    } else {
      if (supEmail && !EMAIL_RE.test(supEmail)) {
        errors.push({
          rowNumber,
          field: "primary_supervisor_email",
          message: `"${supEmail}" is not a valid email address.`,
        });
        return;
      }
      if (obligation && !DATE_RE.test(obligation)) {
        errors.push({
          rowNumber,
          field: "obligation_started_at",
          message: `Date must be YYYY-MM-DD (got "${obligation}").`,
        });
        return;
      }
      // If a rule is set but no start date, that's invalid (matches the invite
      // action's check). Symmetric: a start date without a rule is benign so we
      // accept it (caller can pin a rule later).
      if (ruleId && !obligation) {
        errors.push({
          rowNumber,
          field: "obligation_started_at",
          message:
            "obligation_started_at is required when rule_id is set.",
        });
        return;
      }
    }

    if (name && name.length > 200) {
      errors.push({
        rowNumber,
        field: "name",
        message: "Name is longer than 200 characters.",
      });
      return;
    }

    rows.push({
      rowNumber,
      email,
      name: name || null,
      role: typedRole,
      primarySupervisorEmail: supEmail || null,
      ruleId: ruleId || null,
      obligationStartedAt: obligation || null,
      externalId: externalId || null,
    });
  });

  return { rawHeaders, unrecognizedHeaders, rows, errors };
}

/** Cross-row validation: every primary_supervisor_email must either be
 *  in the CSV as a supervisor row OR present as an existing org supervisor.
 *  Pure — caller passes in the set of existing supervisor emails. */
export function validateSupervisorRefs(
  parsedRows: ParsedRow[],
  existingSupervisorEmails: Set<string>
): RowError[] {
  const errors: RowError[] = [];
  const inCsvSupervisors = new Set(
    parsedRows
      .filter((r) => r.role === "supervisor")
      .map((r) => r.email)
  );
  for (const r of parsedRows) {
    if (r.role !== "supervisee") continue;
    if (!r.primarySupervisorEmail) continue;
    if (
      !inCsvSupervisors.has(r.primarySupervisorEmail) &&
      !existingSupervisorEmails.has(r.primarySupervisorEmail)
    ) {
      errors.push({
        rowNumber: r.rowNumber,
        field: "primary_supervisor_email",
        message: `Supervisor ${r.primarySupervisorEmail} is not in the CSV or in your org. Add them as a supervisor row or invite them first.`,
      });
    }
  }
  return errors;
}
