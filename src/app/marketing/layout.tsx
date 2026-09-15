import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuditHaloWordmark } from "@/components/brand/AuditHaloMark";
import { MobileNav } from "@/components/marketing/mobile-nav";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/states", label: "States" },
  { href: "/for-supervisors", label: "For Supervisors" },
  { href: "/for-group-practices", label: "For Practices" },
  { href: "/blog", label: "Guides" },
  { href: "/docs", label: "Docs" },
  { href: "/security", label: "Security" },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 bg-[color:var(--paper-50)]">
      <header className="border-b border-[color:var(--ink-200)] bg-[color:var(--paper-50)]/90 backdrop-blur-sm sticky top-0 z-30">
        <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-8">
          <Link href="/" className="shrink-0" aria-label="AuditHalo home">
            <AuditHaloWordmark />
          </Link>
          <ul className="hidden md:flex items-center gap-8 text-sm font-medium text-[color:var(--ink-600)]">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:text-[color:var(--ink-900)] transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <a href="https://app.audithalo.com/login">Sign in</a>
            </Button>
            <Button asChild size="sm" className="hidden md:inline-flex">
              <a href="https://app.audithalo.com/register">Start free trial</a>
            </Button>
            <MobileNav />
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-[color:var(--ink-900)] text-[color:var(--paper-50)]">
        <div className="mx-auto max-w-6xl px-6 py-14 grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8">
          <div className="col-span-2 md:col-span-1">
            <AuditHaloWordmark textClassName="text-[color:var(--paper-50)]" />
            {/* Locked tagline (brand-voice.md). Recurring footer line on
                every marketing page so the brand promise is in peripheral
                vision sitewide. */}
            <p className="mt-3 text-sm font-medium text-[rgba(250,247,240,0.7)] max-w-xs leading-snug">
              Audit-ready supervision. Every hour, every state, every signature.
            </p>
          </div>
          <div>
            <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-wider text-[rgba(250,247,240,0.5)]">Product</p>
            <ul className="space-y-2.5 text-sm text-[rgba(250,247,240,0.85)]">
              <li>
                <Link href="/features" className="hover:text-[color:var(--halo-yellow)]">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-[color:var(--halo-yellow)]">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/security" className="hover:text-[color:var(--halo-yellow)]">
                  Security
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-[color:var(--halo-yellow)]">
                  Guides
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-[color:var(--halo-yellow)]">
                  Docs
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-wider text-[rgba(250,247,240,0.5)]">For</p>
            <ul className="space-y-2.5 text-sm text-[rgba(250,247,240,0.85)]">
              <li>
                <Link
                  href="/for-supervisors"
                  className="hover:text-[color:var(--halo-yellow)]"
                >
                  Supervisors
                </Link>
              </li>
              <li>
                <Link href="/for-group-practices" className="hover:text-[color:var(--halo-yellow)]">
                  Practices
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-wider text-[rgba(250,247,240,0.5)]">Company</p>
            <ul className="space-y-2.5 text-sm text-[rgba(250,247,240,0.85)]">
              <li>
                <Link href="/contact" className="hover:text-[color:var(--halo-yellow)]">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="hover:text-[color:var(--halo-yellow)]">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="hover:text-[color:var(--halo-yellow)]">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[rgba(250,247,240,0.15)]">
          <div className="mx-auto max-w-6xl px-6 py-6 flex flex-wrap items-center justify-between gap-4">
            <p className="font-mono text-xs text-[rgba(250,247,240,0.5)]">
              © {new Date().getFullYear()} AuditHalo. Built for state-board
              audits, not against them.
            </p>
            <p className="font-mono text-xs text-[rgba(250,247,240,0.5)]">
              Made for LCMHCA · APCC · LPC-A · RMHCI · LP-MHC · LAC · LACMH · LPC · PLPC · LMHCA
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
