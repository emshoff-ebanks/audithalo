/**
 * Node-side DB verifier for Playwright tests.
 *
 * CRITICAL — DO NOT IMPORT THIS FILE FROM SPEC CODE THAT RUNS IN A BROWSER.
 * It uses pg directly with DATABASE_URL, a privileged credential that must
 * never enter browser context. Import it only inside `test.beforeAll`,
 * `test.afterAll`, or non-page-context test bodies — those run in the
 * Playwright test worker (Node), not the browser.
 *
 * Used by spec files to verify post-action DB state, e.g. after a UI click
 * confirm that the right row was inserted, the right column was updated,
 * and no forbidden side effects occurred.
 */

import { Pool } from "pg";

// Lazy singleton — first test that needs the DB triggers the connection.
let _pool: Pool | null = null;
function pool(): Pool {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL not set — required for Playwright DB verifier."
    );
  }
  _pool = new Pool({ connectionString: url });
  return _pool;
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

// ─── Membership / role queries ────────────────────────────────────────────

export async function getMembershipRole(
  userId: string,
  orgId: string
): Promise<string | null> {
  const r = await pool().query(
    `SELECT role::text AS role FROM org_memberships
     WHERE user_id = $1 AND org_id = $2 AND deactivated_at IS NULL
     LIMIT 1`,
    [userId, orgId]
  );
  return r.rows[0]?.role ?? null;
}

export async function getOrgTier(orgId: string): Promise<string | null> {
  const r = await pool().query(
    `SELECT subscription_tier FROM organizations WHERE id = $1`,
    [orgId]
  );
  return r.rows[0]?.subscription_tier ?? null;
}

// ─── Supervisor assignment queries ────────────────────────────────────────

export type SupervisorAssignmentRow = {
  id: string;
  supervisor_id: string;
  supervisee_id: string;
  is_primary: boolean;
  started_at: Date;
  ended_at: Date | null;
  transferred_from_supervisor_id: string | null;
};

export async function getActiveSupervisorAssignment(
  superviseeId: string,
  orgId: string
): Promise<SupervisorAssignmentRow | null> {
  const r = await pool().query(
    `SELECT id, supervisor_id, supervisee_id, is_primary, started_at,
            ended_at, transferred_from_supervisor_id
     FROM supervisor_assignments
     WHERE supervisee_id = $1 AND org_id = $2 AND ended_at IS NULL
     LIMIT 1`,
    [superviseeId, orgId]
  );
  return r.rows[0] ?? null;
}

export async function getAllSupervisorAssignments(
  superviseeId: string,
  orgId: string
): Promise<SupervisorAssignmentRow[]> {
  const r = await pool().query(
    `SELECT id, supervisor_id, supervisee_id, is_primary, started_at,
            ended_at, transferred_from_supervisor_id
     FROM supervisor_assignments
     WHERE supervisee_id = $1 AND org_id = $2
     ORDER BY started_at DESC`,
    [superviseeId, orgId]
  );
  return r.rows;
}

// ─── Audit log queries ────────────────────────────────────────────────────

export async function findAuditLogEntry(opts: {
  orgId: string;
  action: string;
  afterTs?: Date;
}): Promise<{ id: string; details: Record<string, unknown>; createdAt: Date } | null> {
  const since = opts.afterTs ?? new Date(Date.now() - 5 * 60 * 1000);
  const r = await pool().query(
    `SELECT id, details, created_at AS "createdAt"
     FROM audit_log_entries
     WHERE org_id = $1 AND action = $2 AND created_at >= $3
     ORDER BY created_at DESC LIMIT 1`,
    [opts.orgId, opts.action, since]
  );
  return r.rows[0] ?? null;
}

// ─── Invitation queries ───────────────────────────────────────────────────

export async function findInvitationByEmail(
  orgId: string,
  email: string
): Promise<{ id: string; role: string; createdAt: Date } | null> {
  const r = await pool().query(
    `SELECT id, role::text AS role, created_at AS "createdAt"
     FROM invitations
     WHERE org_id = $1 AND lower(email) = lower($2)
     ORDER BY created_at DESC LIMIT 1`,
    [orgId, email]
  );
  return r.rows[0] ?? null;
}

export async function deleteInvitationsByEmail(email: string): Promise<number> {
  const r = await pool().query(
    `DELETE FROM invitations WHERE lower(email) = lower($1)`,
    [email]
  );
  return r.rowCount ?? 0;
}

/**
 * Pre-seed an invitation directly for tests that need to exercise the
 * "cancel an existing invite" path without first running an invite flow.
 * Uses a placeholder token_hash + 30-day expiry. Inviter is the org's
 * createdBy (the HR Admin in our seeded org).
 */
export async function seedInvitation(opts: {
  orgId: string;
  email: string;
  role: "supervisor" | "supervisee" | "hr_admin" | "executive";
  name?: string;
}): Promise<{ id: string }> {
  const r = await pool().query(
    `INSERT INTO invitations
       (org_id, email, name, role, token_hash, expires_at, invited_by_id)
     SELECT $1, $2, $3, $4::user_role, $5,
            NOW() + INTERVAL '30 days',
            o.created_by_id
     FROM organizations o WHERE o.id = $1
     RETURNING id`,
    [
      opts.orgId,
      opts.email,
      opts.name ?? null,
      opts.role,
      `e2e-seeded-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ]
  );
  return { id: r.rows[0].id };
}

// ─── Org settings queries ─────────────────────────────────────────────────

export async function getOrgSettings(
  orgId: string
): Promise<{ auditLogRetentionYears: number } | null> {
  const r = await pool().query(
    `SELECT audit_log_retention_years AS "auditLogRetentionYears"
     FROM org_settings WHERE org_id = $1`,
    [orgId]
  );
  return r.rows[0] ?? null;
}

export async function setOrgRetentionYears(
  orgId: string,
  years: number
): Promise<void> {
  await pool().query(
    `UPDATE org_settings SET audit_log_retention_years = $2, updated_at = NOW()
     WHERE org_id = $1`,
    [orgId, years]
  );
}

// ─── Smoke-row cleanup ────────────────────────────────────────────────────

/**
 * Generates a unique prefix for test-created rows. Use as part of any
 * test-created name, email, or label so cleanupSmokeRows() can find them.
 *   const tag = smokeTag();
 *   const email = `e2e+${tag}@audithalo.test`;
 */
export function smokeTag(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `E2E_${ts}_${rand}`;
}

/**
 * Remove rows tagged with the given prefix. Failures here are non-fatal —
 * the test should still pass if assertions passed; orphaned smoke rows
 * will be obvious from their prefix and can be cleaned up manually.
 */
export async function cleanupSmokeRows(prefix: string): Promise<void> {
  try {
    await pool().query(
      `DELETE FROM invitations WHERE email LIKE $1 OR name LIKE $1`,
      [`%${prefix}%`]
    );
    await pool().query(
      `DELETE FROM users WHERE email LIKE $1`,
      [`%${prefix}%`]
    );
  } catch (err) {
    console.error(`[e2e cleanup] failed for prefix ${prefix}:`, err);
  }
}
