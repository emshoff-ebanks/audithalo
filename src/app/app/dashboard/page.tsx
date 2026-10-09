import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentMembership, isAdminEmail } from "@/lib/authz";
import { SupervisorDashboard } from "./_supervisor-dashboard";
import { SuperviseeDashboard } from "./_supervisee-dashboard";
import { AdminOverview } from "./_admin-overview";

export const metadata = { title: "Dashboard — AuditHalo" };

function parseWeekOffset(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(v ?? "", 10);
  // Clamp to a sane window so a hand-edited URL can't wander far.
  return Number.isFinite(n) ? Math.max(-52, Math.min(52, n)) : 0;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ wk?: string | string[] }>;
}) {
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

  const weekOffset = parseWeekOffset((await searchParams).wk);

  // Route by role. Executive + HR Admin both land on the org-wide Admin
  // Overview (role-tailored affordances inside). Supervisor keeps the
  // supervisor dashboard; supervisee keeps the supervisee dashboard.
  if (session.user.role === "supervisee") {
    return <SuperviseeDashboard {...baseProps} />;
  }
  if (session.user.role === "executive" || session.user.role === "hr_admin") {
    const membership = await getCurrentMembership(session.user.id);
    if (!membership) {
      redirect("/login");
    }
    return (
      <AdminOverview
        role={session.user.role}
        orgId={membership.orgId}
        viewerUserId={session.user.id}
      />
    );
  }
  return <SupervisorDashboard {...baseProps} weekOffset={weekOffset} />;
}
