import Link from "next/link";
import { auth } from "@/auth";
import { AuditHaloWordmark } from "@/components/brand/AuditHaloMark";
import { UserMenu } from "./user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" aria-label="AuditHalo home">
            <AuditHaloWordmark />
          </Link>
          {session?.user ? (
            <UserMenu
              name={session.user.name ?? session.user.email}
              role={session.user.role}
            />
          ) : (
            <p className="label-overline">Application</p>
          )}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
