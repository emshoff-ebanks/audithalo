import Link from "next/link";
import { AuditHaloWordmark } from "@/components/brand/AuditHaloMark";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="AuditHalo home">
            <AuditHaloWordmark />
          </Link>
          <p className="label-overline">Application</p>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
