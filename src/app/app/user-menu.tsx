"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";

export function UserMenu({ name, role }: { name: string; role: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-4">
      <div className="hidden sm:flex flex-col items-end leading-tight">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <span className="text-xs text-foreground/60 capitalize">{role}</span>
      </div>
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
