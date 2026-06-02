import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isManagerRole } from "@/lib/authz";
import { SupervisorDashboard } from "./_supervisor-dashboard";
import { SuperviseeDashboard } from "./_supervisee-dashboard";

export const metadata = { title: "Dashboard — AuditHalo" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const props = {
    userId: session.user.id,
    userName: session.user.name ?? null,
    userEmail: session.user.email,
  };

  return isManagerRole(session.user.role) ? (
    <SupervisorDashboard {...props} />
  ) : (
    <SuperviseeDashboard {...props} />
  );
}
