import Link from "next/link";
import { auth } from "@/auth";
import { AuditHaloWordmark } from "@/components/brand/AuditHaloMark";
import { PostHogIdentify } from "@/components/observability/posthog-identify";
import { listUnreadNotifications } from "@/lib/notifications";
import { UserMenu } from "./user-menu";
import { NotificationsBell, type NotificationRow } from "./_notifications-bell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // The bell is "best effort" — a DB hiccup on the notifications table must
  // never take down the whole app-side layout (which would 500 every route,
  // including /login). Swallow the error, log it, and render an empty bell.
  let initialNotifications: NotificationRow[] = [];
  if (session?.user?.id) {
    try {
      const rows = await listUnreadNotifications(session.user.id);
      initialNotifications = rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        payload: n.payload as Record<string, unknown>,
        createdAt: n.createdAt.toISOString(),
      }));
    } catch (err) {
      console.error("[layout] listUnreadNotifications failed:", err);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-background">
      {session?.user?.id && session.user.email ? (
        <PostHogIdentify
          userId={session.user.id}
          email={session.user.email}
          role={session.user.role}
        />
      ) : null}
      <header className="border-b border-border bg-card">
        <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" aria-label="AuditHalo home">
            <AuditHaloWordmark />
          </Link>
          {session?.user ? (
            <div className="flex items-center gap-2">
              <NotificationsBell initialNotifications={initialNotifications} />
              <UserMenu
                name={session.user.name ?? session.user.email}
                role={session.user.role}
              />
            </div>
          ) : (
            <p className="label-overline">Application</p>
          )}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
