"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";

export function UserMenu({ name, role }: { name: string; role: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex flex-col items-end leading-tight">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <span className="text-xs text-foreground/60 capitalize">{role}</span>
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
