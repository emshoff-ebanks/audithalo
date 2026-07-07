"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Briefcase,
  Calendar as CalendarIcon,
  ChevronDown,
  ClipboardList,
  LogOut,
  ScrollText,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { logoutAction } from "@/app/actions/auth";

const ROLE_LABEL: Record<string, string> = {
  supervisee: "Supervisee",
  supervisor: "Supervisor",
  hr_admin: "HR Admin",
  executive: "Executive",
};

type NavLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Primary CTA — renders in the brand-secondary color. Only one per nav. */
  primary?: boolean;
  /** Roles that should see this link. */
  roles: ReadonlyArray<"supervisee" | "supervisor" | "hr_admin" | "executive">;
};

// Top-level nav links rendered on the desktop nav bar (sm+). On mobile
// (<sm) the same set is folded into the profile dropdown so the bar
// itself collapses to just the bell + the avatar.
const TOP_LINKS: NavLink[] = [
  {
    href: "/dashboard/roster",
    label: "Manage roster",
    icon: Users,
    primary: true,
    roles: ["supervisor", "hr_admin"],
  },
  {
    href: "/dashboard/team",
    label: "Team",
    icon: Briefcase,
    roles: ["hr_admin"],
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: CalendarIcon,
    roles: ["supervisor", "hr_admin"],
  },
];

type DropdownLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ReadonlyArray<"supervisee" | "supervisor" | "hr_admin" | "executive">;
};

const DROPDOWN_LINKS: DropdownLink[] = [
  {
    href: "/dashboard/account",
    label: "Account",
    icon: SettingsIcon,
    roles: ["supervisee", "supervisor", "hr_admin", "executive"],
  },
  {
    href: "/dashboard/audit-log",
    label: "Audit log",
    icon: ScrollText,
    roles: ["hr_admin", "executive"],
  },
  {
    href: "/dashboard/team/rules",
    label: "State rules",
    icon: ClipboardList,
    roles: ["hr_admin"],
  },
  {
    href: "/dashboard/settings",
    label: "Org settings",
    icon: SlidersHorizontal,
    roles: ["hr_admin"],
  },
];

export function UserMenu({ name, role }: { name: string; role: string }) {
  const roleLabel = ROLE_LABEL[role] ?? role;
  const allowedTopLinks = TOP_LINKS.filter((l) =>
    l.roles.includes(role as never)
  );
  const allowedDropdownLinks = DROPDOWN_LINKS.filter((l) =>
    l.roles.includes(role as never)
  );

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Top-level nav — desktop only. On mobile every link folds into
          the profile dropdown so the bar stays uncluttered. */}
      <ul className="hidden sm:flex items-center gap-1">
        {allowedTopLinks.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={
                // Primary CTA matches the in-app default Button variant
                // (bg-primary = deep navy #071a3d). The bright royal-blue
                // `bg-secondary` is reserved for accent/link hover states.
                link.primary
                  ? "inline-flex items-center gap-1.5 rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 px-3 h-9 text-sm font-medium shadow-sm"
                  : "inline-flex items-center gap-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground px-3 h-9 text-sm font-medium text-foreground/80 hover:text-foreground"
              }
            >
              <link.icon className="h-4 w-4" />
              <span>{link.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <ProfileDropdown
        name={name}
        roleLabel={roleLabel}
        topLinks={allowedTopLinks}
        dropdownLinks={allowedDropdownLinks}
      />
    </div>
  );
}

function ProfileDropdown({
  name,
  roleLabel,
  topLinks,
  dropdownLinks,
}: {
  name: string;
  roleLabel: string;
  topLinks: NavLink[];
  dropdownLinks: DropdownLink[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape so the dropdown feels native.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-sm hover:bg-accent hover:text-accent-foreground pl-1 pr-1.5 sm:pr-2 h-9"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name} — account menu`}
      >
        <InitialsAvatar name={name} size="sm" />
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span className="text-[10px] uppercase tracking-wide text-foreground/60">
            {roleLabel}
          </span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-foreground/60" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border border-border bg-card shadow-lg overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border sm:hidden">
            <p className="text-sm font-medium text-foreground truncate">
              {name}
            </p>
            <Badge variant="outline" className="text-[9px] mt-1">
              {roleLabel}
            </Badge>
          </div>

          {/* Mobile-only nav links — folds the desktop top bar into the
              dropdown so the visible bar reduces to bell + avatar. */}
          {topLinks.length > 0 && (
            <ul className="sm:hidden border-b border-border py-1">
              {topLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    <link.icon className="h-4 w-4 text-foreground/60" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <ul className="py-1">
            {dropdownLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
                >
                  <link.icon className="h-4 w-4 text-foreground/60" />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-border">
            <form
              action={() => {
                setOpen(false);
                startTransition(() => logoutAction());
              }}
            >
              <button
                type="submit"
                disabled={pending}
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-60"
              >
                <LogOut className="h-4 w-4 text-foreground/60" />
                {pending ? "Signing out…" : "Sign out"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

