"use client";

import { useActionState, useTransition } from "react";
import { updateMemberRoleAction } from "@/app/actions/team";

type Result = { ok: true } | { ok: false; error: string };

const OPTIONS = [
  { value: "supervisor", label: "Supervisor" },
  { value: "hr_admin", label: "HR Admin" },
  { value: "executive", label: "Executive" },
] as const;

export function RoleSelector({
  targetUserId,
  currentRole,
}: {
  targetUserId: string;
  currentRole: "supervisor" | "hr_admin" | "executive";
}) {
  const [state, formAction, pending] = useActionState<Result | undefined, FormData>(
    updateMemberRoleAction,
    undefined
  );
  const [, startTransition] = useTransition();

  return (
    <form action={formAction}>
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <div className="flex items-center gap-2">
        <select
          name="newRole"
          defaultValue={currentRole}
          disabled={pending}
          onChange={(e) => {
            const fd = new FormData();
            fd.set("targetUserId", targetUserId);
            fd.set("newRole", e.target.value);
            startTransition(() => formAction(fd));
          }}
          className="h-9 rounded-sm border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {pending && <span className="text-xs text-foreground/60">Saving…</span>}
      </div>
      {state && state.ok === false && (
        <p
          role="alert"
          className="mt-1 text-xs text-[color:var(--color-risk)]"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
