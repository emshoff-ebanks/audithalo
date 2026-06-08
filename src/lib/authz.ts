import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";

// ---------------------------------------------------------------------------
// Role-based authorization
//
// Source of truth in v1 was `users.role`. For Enterprise (migration 0023)
// the source of truth is `org_memberships.role` — a single user can hold
// different roles in different orgs. For backward compatibility with the
// existing Solo/Practice flow we still read `session.user.role` (sourced
// from users.role at JWT mint time) — but ANY new check that depends on
// what the user can do INSIDE A SPECIFIC ORG should pull the membership
// row via getCurrentMembership() and read membership.role.
//
// Role matrix lives in docs/strategy/04-enterprise-rbac.md.
// ---------------------------------------------------------------------------

type Role = "supervisee" | "supervisor" | "hr_admin" | "executive";

/** Anyone who can READ org-level management surfaces (roster, audit log,
 *  executive dashboard, billing UI). Supervisor, HR Admin, Executive.
 *  Supervisee NEVER gets this. */
const MANAGER_ROLES = new Set<Role>(["supervisor", "hr_admin", "executive"]);

/** True if this role is a "manager-tier" role — supervisor, HR Admin,
 *  or Executive. Coarse-grained — use more specific helpers below for
 *  fine-grained checks (canSupervise, canManageTeam, canExport, etc.). */
export function isManagerRole(role: string | undefined | null): boolean {
  return !!role && MANAGER_ROLES.has(role as Role);
}

/** Clinical-supervisor permission. ONLY supervisors. Used to gate:
 *  signing supervision sessions, assigning state rules, logging
 *  supervision events. HR Admins and Executives do NOT pass this check —
 *  the clinical/admin firewall is intentional. */
export function canSupervise(role: string | undefined | null): boolean {
  return role === "supervisor";
}

/** True for HR Admin only. Gates team-management, billing, integrations,
 *  org settings, audit-log export. */
export function isHrAdmin(role: string | undefined | null): boolean {
  return role === "hr_admin";
}

/** True for Executive only. Read-only oversight role — sees the
 *  practice-wide rollup, audit log (read), and can export. Cannot sign,
 *  log sessions, or change anything. */
export function isExecutive(role: string | undefined | null): boolean {
  return role === "executive";
}

/** Org-wide read access — HR Admin and Executive both see the whole
 *  roster + executive dashboard. Supervisor only sees their own roster. */
export function canViewWholeOrg(role: string | undefined | null): boolean {
  return isHrAdmin(role) || isExecutive(role);
}

/** Org-wide write access — only HR Admin. Gates inviting supervisors /
 *  other HR Admins, reassigning supervisees, deactivating users, etc. */
export function canManageOrg(role: string | undefined | null): boolean {
  return isHrAdmin(role);
}

/** Audit-log export permission. HR Admin (full) + Executive (read-only). */
export function canExportAuditLog(role: string | undefined | null): boolean {
  return isHrAdmin(role) || isExecutive(role);
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/**
 * Bounce supervisees away from manager-only routes back to their own
 * detail page. Executives go to the executive dashboard (they don't have
 * a personal roster view). HR Admins and Supervisors pass through.
 */
export async function requireManager() {
  const session = await requireSession();
  const role = session.user.role;
  if (isExecutive(role)) {
    redirect("/dashboard/executive");
  }
  if (!isManagerRole(role)) {
    redirect(`/dashboard/roster/${session.user.id}`);
  }
  return session;
}

/** HR Admin-only routes: /dashboard/team, /dashboard/billing (Enterprise),
 *  integrations setup. */
export async function requireHrAdmin() {
  const session = await requireSession();
  if (!isHrAdmin(session.user.role)) {
    redirect("/dashboard");
  }
  return session;
}

/** Executive + HR Admin routes: /dashboard/executive read-only rollup. */
export async function requireExecutiveOrHrAdmin() {
  const session = await requireSession();
  if (!isHrAdmin(session.user.role) && !isExecutive(session.user.role)) {
    redirect("/dashboard");
  }
  return session;
}

/** First org membership for a given user. v1 assumes one user = one org. */
export async function getCurrentMembership(userId: string) {
  return db.query.orgMemberships.findFirst({
    where: eq(schema.orgMemberships.userId, userId),
  });
}

/** Pure: is this user the creator of this org? Used to gate team-management actions. */
export function isOrgOwner(userId: string, org: { createdById: string }): boolean {
  return userId === org.createdById;
}

/**
 * Workspace-admin check (distinct from supervisor/manager). Backed by the
 * ADMIN_EMAILS env var — comma-separated list of email addresses. Used to gate
 * internal-tooling routes like /admin/rule-drift and the demo-reset endpoint.
 * Lowercased on comparison; empty / unset env var = nobody is admin.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

/** Bounce non-admins to the dashboard. Used at the top of admin server pages. */
export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdminEmail(session.user.email)) {
    redirect("/dashboard");
  }
  return session;
}
