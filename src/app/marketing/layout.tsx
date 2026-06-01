import Link from "next/link";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/for-supervisors", label: "For Supervisors" },
  { href: "/security", label: "Security" },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-8">
          <Link
            href="/"
            className="font-display text-xl font-bold text-foreground shrink-0"
          >
            AuditHalo
          </Link>
          <ul className="hidden md:flex items-center gap-8 text-sm font-medium text-foreground/70">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="ghost" size="sm">
              <a href="https://app.audithalo.com/login">Sign in</a>
            </Button>
            <Button asChild size="sm">
              <a href="https://app.audithalo.com/register">Start free trial</a>
            </Button>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <p className="font-display text-lg font-bold text-foreground">
              AuditHalo
            </p>
            <p className="mt-2 text-sm text-foreground/60 max-w-xs">
              Audit-ready supervision compliance for licensed counselors and
              their supervisors.
            </p>
          </div>
          <div>
            <p className="label-overline mb-3">Product</p>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>
                <Link href="/features" className="hover:text-foreground">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/security" className="hover:text-foreground">
                  Security
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="label-overline mb-3">For</p>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>
                <Link
                  href="/for-supervisors"
                  className="hover:text-foreground"
                >
                  Supervisors
                </Link>
              </li>
              <li>
                <Link
                  href="/for-practices"
                  className="hover:text-foreground"
                >
                  Practices
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="label-overline mb-3">Legal</p>
            <ul className="space-y-2 text-sm text-foreground/70">
              <li>
                <Link href="/legal/privacy" className="hover:text-foreground">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="hover:text-foreground">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-foreground/60">
              © {new Date().getFullYear()} AuditHalo. Built for state-board
              audits, not against them.
            </p>
            <p className="text-sm text-foreground/60">
              Made for LCMHCA · APCC · LPC-A · RMHCI · LMHC
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
