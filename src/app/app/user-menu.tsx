"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";

const ROLE_LABEL: Record<string, string> = {
  supervisee: "Supervisee",
  supervisor: "Supervisor",
  hr_admin: "HR Admin",
  executive: "Executive",
};

export function UserMenu({ name, role }: { name: string; role: string }) {
  const [pending, startTransition] = useTransition();
  const roleLabel = ROLE_LABEL[role] ?? role;

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
