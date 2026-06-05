import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { SupervisorDashboard } from "./_supervisor-dashboard";
import { SuperviseeDashboard } from "./_supervisee-dashboard";
import { HrDashboard } from "./_hr-dashboard";
import { ExecutiveDashboard } from "./_executive-dashboard";

export const metadata = { title: "Dashboard — AuditHalo" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { emailVerifiedAt: true },
  });

  const baseProps = {
    userId: session.user.id,
    userName: session.user.name ?? null,
    userEmail: session.user.email,
  };

  const role = session.user.role;

  if (role === "supervisee") {
    return <SuperviseeDashboard {...baseProps} />;
  }
  if (role === "hr_admin") {
    return <HrDashboard {...baseProps} />;
  }
  if (role === "executive") {
    return <ExecutiveDashboard {...baseProps} />;
  }
  // supervisor (default for any other manager-like role)
  return (
    <SupervisorDashboard
      {...baseProps}
      emailVerifiedAt={user?.emailVerifiedAt ?? null}
    />
  );
}
