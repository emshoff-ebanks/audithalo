"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { ProfileMenu } from "./profile-menu";
import { ThemeToggle } from "./theme-toggle";
import { NAV_GROUPS, type AppRole } from "./nav-config";
import {
  NotificationsBell,
  type NotificationRow,
} from "@/app/app/_notifications-bell";

function sectionLabel(pathname: string): string {
  const all = NAV_GROUPS.flatMap((g) => g.items);
  const match = all
    .filter((i) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (match) return match.label;
  const seg = pathname.split("/").filter(Boolean).pop() ?? "";
  return seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : "AuditHalo";
}

export function AppShell({
  role,
  name,
  initialTheme,
  notifications,
  children,
}: {
  role: AppRole;
  name: string;
  initialTheme: "light" | "dark";
  notifications: NotificationRow[];
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Keep <html> in sync so the browser chrome / overscroll gutter matches
  // the shell. Seeded server-side via the wrapper class → no flash.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Close the mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.cookie = `ah-theme=${next}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  return (
    <div className={`app-shell${theme === "dark" ? " dark" : ""}`}>
      {mobileOpen ? (
        <div className="shell-scrim" onClick={() => setMobileOpen(false)} aria-hidden />
      ) : null}

      <aside className={`shell-sidebar${mobileOpen ? " open" : ""}`}>
        <SidebarNav role={role} onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div className="app-main">
        <header className="shell-header">
          <div className="shell-header-lead">
            <button
              type="button"
              className="shell-icon-btn shell-menu-btn"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </button>
            <span className="shell-eyebrow">{sectionLabel(pathname)}</span>
          </div>
          <div className="shell-header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <NotificationsBell initialNotifications={notifications} />
            <ProfileMenu name={name} role={role} />
          </div>
        </header>

        <main className="shell-canvas">{children}</main>
      </div>
    </div>
  );
}
