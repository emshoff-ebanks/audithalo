import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentMembership, isAdminEmail } from "@/lib/authz";
import { SupervisorDashboard } from "./_supervisor-dashboard";
import { SuperviseeDashboard } from "./_supervisee-dashboard";

export const metadata = { title: "Dashboard — AuditHalo" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Workspace super-admins (info@audithalo.com via ADMIN_EMAILS env var)
  // don't belong to any customer org — their landing surface is /admin.
  // Without this short-circuit, the role-specific dashboards below would
  // try to read getCurrentMembership(), hit null, and bounce them back
  // to /login.
  if (isAdminEmail(session.user.email)) {
    const membership = await getCurrentMembership(session.user.id);
    if (!membership) {
      redirect("/admin/orgs");
    }
  }

  const baseProps = {
    userId: session.user.id,
    userName: session.user.name ?? null,
    userEmail: session.user.email,
  };

  // Route by role. Executive lands on their dedicated rollup (no roster
  // page for them — they're read-only oversight). HR Admin sees the
  // supervisor dashboard for now; future iterations may build a dedicated
  // HR Admin landing with practice-wide overview cards.
  if (session.user.role === "executive") {
    redirect("/dashboard/executive");
  }
  if (session.user.role === "supervisee") {
    return <SuperviseeDashboard {...baseProps} />;
  }
  // supervisor + hr_admin both see the supervisor dashboard. The
  // supervisor dashboard's queries already use org-scoped reads, so
  // HR Admin sees the whole roster correctly.
  return <SupervisorDashboard {...baseProps} />;
}
