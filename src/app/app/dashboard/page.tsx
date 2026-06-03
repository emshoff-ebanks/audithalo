import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SupervisorDashboard } from "./_supervisor-dashboard";
import { SuperviseeDashboard } from "./_supervisee-dashboard";
import { HrDashboard } from "./_hr-dashboard";
import { ExecutiveDashboard } from "./_executive-dashboard";

export const metadata = { title: "Dashboard — AuditHalo" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const props = {
    userId: session.user.id,
    userName: session.user.name ?? null,
    userEmail: session.user.email,
  };

  const role = session.user.role;

  if (role === "supervisee") {
    return <SuperviseeDashboard {...props} />;
  }
  if (role === "hr_admin") {
    return <HrDashboard {...props} />;
  }
  if (role === "executive") {
    return <ExecutiveDashboard {...props} />;
  }
  // supervisor (default for any other manager-like role)
  return <SupervisorDashboard {...props} />;
}
