/**
 * Merge.dev HRIS integration — SCAFFOLD ONLY.
 *
 * Merge.dev is a unified API that fronts ~30 HRIS providers (Workday,
 * BambooHR, Rippling, Gusto, ADP, etc.) behind one schema. The
 * `audithalo-enterprise` plan promises HRIS integration; the path to
 * delivery is a Merge.dev link account flow rather than building 30
 * separate integrations.
 *
 * This file deliberately doesn't make HTTP calls — it only declares the
 * shape of what an integration would do once Damon signs a Merge.dev
 * contract and we get production credentials. The CSV import path is the
 * MVP for Enterprise customers in the meantime; this Merge.dev scaffold is
 * forward-compat so the same pipeline (validation → bulk invite) can be
 * triggered by a Merge.dev webhook later without rewriting the action
 * layer.
 *
 * See docs/strategy/05-hris-integration.md for the contract spec, the
 * three-phase rollout (CSV → Merge.dev pull → Merge.dev push), and the
 * security review punch list.
 */

import type { ParsedRow } from "./csv-parser";

/**
 * Merge.dev Employee object — the subset of fields we map to AuditHalo's
 * invitation row. Real shape:
 *   https://docs.merge.dev/hris/employees/
 *
 * We only persist `remote_id` (becomes external_id), `work_email`, and
 * `display_full_name`. The "role" is NOT in Merge's schema — we'll need
 * the customer to designate role per-employee via tag, group membership,
 * or a one-time mapping spreadsheet during onboarding. */
export type MergeEmployee = {
  /** Merge's stable id (uuid). */
  id: string;
  /** Vendor-side employee id, e.g. Workday's "Employee_ID". */
  remote_id: string | null;
  display_full_name: string | null;
  work_email: string | null;
  employments?: {
    job_title: string | null;
  }[];
};

/**
 * Best-effort mapping from a Merge.dev employee to our ParsedRow shape.
 *
 * Role is the only field we can't infer — caller passes `defaultRole`
 * (usually "supervisee" for a bulk import targeting the supervisee
 * population). Returns null for employees with no work_email since we
 * can't invite without one. */
export function mergeEmployeeToParsedRow(
  emp: MergeEmployee,
  defaultRole: ParsedRow["role"],
  rowNumber: number
): ParsedRow | null {
  if (!emp.work_email) return null;
  return {
    rowNumber,
    email: emp.work_email.toLowerCase(),
    name: emp.display_full_name?.trim() || null,
    role: defaultRole,
    primarySupervisorEmail: null,
    ruleId: null,
    obligationStartedAt: null,
    externalId: emp.remote_id ?? emp.id,
  };
}

/**
 * Three-phase rollout plan (kept here so future-you can grep for it):
 *
 *   Phase 1 — CSV upload (DONE in this commit)
 *     HR Admin downloads template, fills it, uploads. Server validates,
 *     previews, then bulk-creates invitations. No Merge.dev required.
 *
 *   Phase 2 — Merge.dev pull-only (1-2 days work post-contract)
 *     HR Admin links their HRIS via Merge's Link UI. We poll their
 *     /employees endpoint nightly, present a diff vs current org members,
 *     HR Admin confirms which ones to invite. Same downstream action.
 *
 *   Phase 3 — Merge.dev webhook + auto-invite (1 week work)
 *     Subscribe to Merge.dev employee webhooks. New hires auto-create
 *     pending invitations tagged with `auto_invited: true`. Terminations
 *     auto-deactivate the corresponding member (with audit log entry).
 *     Requires an opt-in setting on org_settings.
 *
 * For phase 1, no env vars are needed. Phase 2 adds:
 *   - MERGE_API_KEY (server-side, per environment)
 *   - MERGE_ORG_TOKEN_PER_ORG (stored encrypted in org_settings.merge_account_token)
 */
export const MERGE_DEV_ROLLOUT_PHASE: 1 | 2 | 3 = 1;
