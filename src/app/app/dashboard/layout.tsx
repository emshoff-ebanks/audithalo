import { cookies } from "next/headers";
import { auth } from "@/auth";
import { listUnreadNotifications } from "@/lib/notifications";
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

  return (
    <AppShell
      role={role}
      name={session.user.name ?? session.user.email ?? "You"}
      initialTheme={theme}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
