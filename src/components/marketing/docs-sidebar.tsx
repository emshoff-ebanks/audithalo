"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { NavCategory } from "@/lib/docs-nav";

function NavList({
  nav,
  pathname,
  onNavigate,
}: {
  nav: NavCategory[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-6">
      {nav.map((cat) => (
        <div key={cat.slug}>
          <Link
            href={`/docs/${cat.slug}`}
            onClick={onNavigate}
            className="label-overline block mb-2 hover:text-foreground"
          >
            {cat.title}
          </Link>
          <ul className="space-y-1 border-l border-border">
            {cat.articles.map((a) => {
              const href = `/docs/${a.path}`;
              const active = pathname === href;
              return (
                <li key={a.path}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`-ml-px block border-l-2 pl-3 py-1 text-sm transition-colors ${
                      active
                        ? "border-secondary text-secondary font-medium"
                        : "border-transparent text-foreground/70 hover:text-foreground hover:border-foreground/30"
                    }`}
                  >
                    {a.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar({ nav }: { nav: NavCategory[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="lg:hidden inline-flex items-center gap-2 text-sm font-medium text-foreground/70 mb-4"
        aria-expanded={open}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        Browse docs
      </button>

      {open && (
        <div className="lg:hidden mb-8 border-b border-border pb-8">
          <NavList
            nav={nav}
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}

      {/* Desktop sticky sidebar */}
      <div className="hidden lg:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-auto pr-4">
        <NavList nav={nav} pathname={pathname} />
      </div>
    </>
  );
}
