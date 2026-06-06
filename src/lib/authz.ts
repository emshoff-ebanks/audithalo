import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";

const MANAGER_ROLES = new Set(["supervisor"]);

/** Roles that can READ management surfaces (roster, supervisee details, dashboards).
 *  As of Phase 5.4 collapse, supervisor is the only manager role. */
export function isManagerRole(role: string | undefined | null): boolean {
  return !!role && MANAGER_ROLES.has(role);
}

/** Roles that can PERFORM supervisor actions: invite, assign rules, log supervision sessions,
 *  sign as supervisor. */
export function canSupervise(role: string | undefined | null): boolean {
  return role === "supervisor";
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/**
 * Bounce supervisees away from manager-only routes back to their own detail page.
 */
export async function requireManager() {
  const session = await requireSession();
  if (!isManagerRole(session.user.role)) {
    redirect(`/dashboard/roster/${session.user.id}`);
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
