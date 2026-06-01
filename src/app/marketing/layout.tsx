import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 bg-background">
      <header className="border-b border-border">
        <nav className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold text-foreground">
            AuditHalo
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="https://app.audithalo.com/login"
              className="text-sm font-medium text-foreground/70 hover:text-foreground px-4 py-2"
            >
              Sign in
            </a>
            <a
              href="https://app.audithalo.com/register"
              className="text-sm font-medium bg-foreground text-background px-4 py-2 rounded-sm hover:bg-foreground/90 transition-colors"
            >
              Get started
            </a>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-foreground/60">
            © {new Date().getFullYear()} AuditHalo
          </p>
          <p className="text-sm text-foreground/60">
            Built for state-board audits, not against them.
          </p>
        </div>
      </footer>
    </div>
  );
}
