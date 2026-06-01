import { redirect } from "next/navigation";
import { auth } from "@/auth";

const MANAGER_ROLES = new Set(["supervisor", "hr_admin", "executive"]);

export function isManagerRole(role: string | undefined | null): boolean {
  return !!role && MANAGER_ROLES.has(role);
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
