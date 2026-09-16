import type { LucideIcon } from "lucide-react";
import {
  Home,
  Users,
  Calendar,
  Briefcase,
  ClipboardList,
  BarChart3,
  SlidersHorizontal,
  ScrollText,
  CreditCard,
  UserCog,
} from "lucide-react";

export type AppRole = "supervisee" | "supervisor" | "hr_admin" | "executive";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: ReadonlyArray<AppRole>;
  /** Home is matched exactly; every other item matches by path prefix. */
  exact?: boolean;
};

export type NavGroup = { label: string | null; items: NavItem[] };

/**
 * Role-aware sidebar navigation. Every href is a real route from
 * docs/strategy/24-app-reference.md §2 — no invented destinations. RBAC is
 * still enforced server-side; this only controls what the nav offers.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Home", icon: Home, exact: true, roles: ["supervisee", "supervisor", "hr_admin"] },
      { href: "/dashboard/executive", label: "Overview", icon: BarChart3, roles: ["executive", "hr_admin"] },
      { href: "/dashboard/roster", label: "Roster", icon: Users, roles: ["supervisor", "hr_admin"] },
      { href: "/dashboard/calendar", label: "Calendar", icon: Calendar, roles: ["supervisee", "supervisor", "hr_admin", "executive"] },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/dashboard/team", label: "Team", icon: Briefcase, roles: ["supervisor", "hr_admin"] },
      { href: "/dashboard/team/rules", label: "State rules", icon: ClipboardList, roles: ["hr_admin"] },
      { href: "/dashboard/settings", label: "Settings", icon: SlidersHorizontal, roles: ["hr_admin"] },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/dashboard/audit-log", label: "Audit log", icon: ScrollText, roles: ["supervisor", "hr_admin", "executive"] },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard, roles: ["supervisor", "hr_admin"] },
      { href: "/dashboard/account", label: "Account", icon: UserCog, roles: ["supervisee", "supervisor", "hr_admin", "executive"] },
    ],
  },
];

export const ROLE_LABEL: Record<AppRole, string> = {
  supervisee: "Supervisee",
  supervisor: "Supervisor",
  hr_admin: "HR Admin",
  executive: "Executive",
};
