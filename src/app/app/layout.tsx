import Link from "next/link";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-xl font-bold text-foreground"
          >
            AuditHalo
          </Link>
          <p className="label-overline">Application</p>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
