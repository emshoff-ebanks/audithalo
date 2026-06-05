import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { SupervisorDashboard } from "./_supervisor-dashboard";
import { SuperviseeDashboard } from "./_supervisee-dashboard";

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

  if (session.user.role === "supervisee") {
    return <SuperviseeDashboard {...baseProps} />;
  }
  return (
    <SupervisorDashboard
      {...baseProps}
      emailVerifiedAt={user?.emailVerifiedAt ?? null}
    />
  );
}
