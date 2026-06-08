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
