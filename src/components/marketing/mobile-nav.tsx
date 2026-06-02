"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/states", label: "States" },
  { href: "/for-supervisors", label: "For Supervisors" },
  { href: "/for-practices", label: "For Practices" },
  { href: "/security", label: "Security" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="md:hidden p-2 -mr-2 text-foreground/70 hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-card border-b border-border z-40 shadow-sm">
          <nav className="mx-auto max-w-6xl px-6 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-3 text-sm font-medium text-foreground/70 hover:text-foreground border-b border-border/50 last:border-none transition-colors"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 pb-2 flex flex-col gap-2">
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href="https://app.audithalo.com/login">Sign in</a>
              </Button>
              <Button asChild size="sm" className="w-full">
                <a href="https://app.audithalo.com/register">Start free trial</a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
