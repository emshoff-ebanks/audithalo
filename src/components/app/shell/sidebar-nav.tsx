"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuditHaloMark } from "@/components/brand/AuditHaloMark";
import { NAV_GROUPS, type AppRole, type NavItem } from "./nav-config";

function isActive(pathname: string, item: NavItem, allHrefs: string[]): boolean {
  if (item.exact) return pathname === item.href;
  const matches = pathname === item.href || pathname.startsWith(item.href + "/");
  if (!matches) return false;
  // Longest-prefix wins so /dashboard/team doesn't also light up on
  // /dashboard/team/rules.
  const longer = allHrefs.find(
    (h) => h !== item.href && h.startsWith(item.href) && (pathname === h || pathname.startsWith(h + "/")),
  );
  return !longer;
}

export function SidebarNav({
  role,
  onNavigate,
}: {
  role: AppRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const allHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));

  const groups = NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <Link href="/dashboard" className="shell-brand" onClick={onNavigate}>
        <AuditHaloMark className="h-[22px] w-[22px]" />
        <span className="shell-brand-text">AuditHalo</span>
      </Link>

      {groups.map((group, gi) => (
        <div key={group.label ?? `group-${gi}`}>
          {group.label ? <div className="shell-nav-label">{group.label}</div> : null}
          <nav className="shell-nav" aria-label={group.label ?? "Primary"}>
            {group.items.map((item) => {
              const active = isActive(pathname, item, allHrefs);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shell-nav-item${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <Icon className="shell-nav-icon" />
                  <span className="shell-nav-text">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </>
  );
}
