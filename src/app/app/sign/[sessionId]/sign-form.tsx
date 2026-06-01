"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signSessionAction } from "@/app/actions/signatures";

type Result = { ok: true } | { ok: false; error: string };

export function SignForm({
  sessionEventId,
  signerRole,
}: {
  sessionEventId: string;
  signerRole: "supervisee" | "supervisor";
}) {
  const [state, formAction, pending] = useActionState<
    Result | undefined,
    FormData
  >(signSessionAction, undefined);

  return (
    <form action={formAction} className="pt-4 border-t border-border space-y-4">
      <input type="hidden" name="sessionEventId" value={sessionEventId} />

      <p className="text-sm text-foreground/70">
        You're signing as a <span className="font-medium capitalize">{signerRole}</span>.
      </p>

      <label className="flex gap-3 items-start cursor-pointer text-sm">
        <input
          type="checkbox"
          name="intent"
          required
          className="mt-0.5 h-4 w-4 accent-[color:var(--color-gold)]"
        />
        <span className="text-foreground/80">
          I confirm that I intend to electronically sign this session record. My name,
          role, IP address, and timestamp will be recorded immutably as part of the
          audit trail.
        </span>
      </label>

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing…" : "Sign session"}
      </Button>
    </form>
  );
}
