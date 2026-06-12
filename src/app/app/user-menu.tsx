"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";

const ROLE_LABEL: Record<string, string> = {
  supervisee: "Supervisee",
  supervisor: "Supervisor",
  hr_admin: "HR Admin",
  executive: "Executive",
};

// Roles that should see the calendar link — supervisor + HR Admin run
// their week off it; supervisees see their own sessions but reach them
// via /dashboard. Executive stays on the executive rollup.
const CALENDAR_ROLES = new Set(["supervisor", "hr_admin"]);

export function UserMenu({ name, role }: { name: string; role: string }) {
  const [pending, startTransition] = useTransition();
  const roleLabel = ROLE_LABEL[role] ?? role;
  const showCalendar = CALENDAR_ROLES.has(role);

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-end leading-tight">
        <span className="hidden sm:block text-sm font-medium text-foreground">
          {name}
        </span>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {roleLabel}
        </Badge>
      </div>
      {showCalendar && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="px-2 sm:px-3"
        >
          <Link href="/dashboard/calendar" aria-label="Calendar">
            <CalendarIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
          </Link>
        </Button>
      )}
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard/account">Account</Link>
      </Button>
      <form
        action={() => startTransition(() => logoutAction())}
        className="inline"
      >
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Signing out…" : "Sign out"}
        </Button>
      </form>
    </div>
  );
}
