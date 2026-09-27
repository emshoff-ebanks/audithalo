import { cookies } from "next/headers";
import { and, count, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { listUnreadNotifications } from "@/lib/notifications";
import { canSupervise, getCurrentMembership, isHrAdmin } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { pendingSignaturesForSupervisor } from "@/lib/supervisor-signatures";
import { AppShell } from "@/components/app/shell/app-shell";
import type { AppRole } from "@/components/app/shell/nav-config";
import type { NotificationRow } from "@/app/app/_notifications-bell";

const APP_ROLES: AppRole[] = ["supervisee", "supervisor", "hr_admin", "executive"];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // No session → the child page's own auth guard redirects to /login. Render
  // children bare so we don't wrap a redirect in an empty shell.
  if (!session?.user?.id) return <>{children}</>;

  const role: AppRole = APP_ROLES.includes(session.user.role as AppRole)
    ? (session.user.role as AppRole)
    : "supervisor";

  // Best-effort notifications (a DB hiccup must not 500 the whole app).
  let notifications: NotificationRow[] = [];
  try {
    const rows = await listUnreadNotifications(session.user.id);
    notifications = rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      payload: n.payload as Record<string, unknown>,
      createdAt: n.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error("[dashboard-layout] listUnreadNotifications failed:", err);
  }

  const theme = (await cookies()).get("ah-theme")?.value === "dark" ? "dark" : "light";

  // Nav count badges — only supervisor / HR Admin have the Supervisees +
  // Signature queue items, so skip the queries for everyone else. Best-
  // effort: a badge is a nicety, never worth 500-ing the shell.
  let navCounts: Record<string, number> | undefined;
  if (role === "supervisor" || role === "hr_admin") {
    try {
      const membership = await getCurrentMembership(session.user.id);
      if (membership) {
        let superviseeCount = 0;
        if (isHrAdmin(role)) {
          // Whole-org roster size — matches the Supervisees (roster) page.
          const [{ value }] = await db
            .select({ value: count() })
            .from(schema.orgMemberships)
            .where(
              and(
                eq(schema.orgMemberships.orgId, membership.orgId),
                eq(schema.orgMemberships.role, "supervisee")
              )
            );
          superviseeCount = value;
        } else {
          // Supervisor: their actively-assigned supervisees.
          const [{ value }] = await db
            .select({ value: count() })
            .from(schema.supervisorAssignments)
            .where(
              and(
                eq(schema.supervisorAssignments.supervisorId, session.user.id),
                eq(schema.supervisorAssignments.orgId, membership.orgId),
                isNull(schema.supervisorAssignments.endedAt)
              )
            );
          superviseeCount = value;
        }
        const pendingCount = canSupervise(role)
          ? (await pendingSignaturesForSupervisor(session.user.id, membership.orgId)).length
          : 0;
        navCounts = {
          supervisees: superviseeCount,
          "signature-queue": pendingCount,
        };
      }
    } catch (err) {
      console.error("[dashboard-layout] nav counts failed:", err);
    }
  }

  return (
    <AppShell
      role={role}
      name={session.user.name ?? session.user.email ?? "You"}
      initialTheme={theme}
      notifications={notifications}
      navCounts={navCounts}
    >
      {children}
    </AppShell>
  );
}
