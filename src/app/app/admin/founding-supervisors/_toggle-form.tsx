"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  toggleFoundingSupervisorAction,
  type ActionResult,
} from "@/app/actions/admin-founding";

type Props = {
  userId: string;
  currentlyFounding: boolean;
};

export function FoundingToggleForm({ userId, currentlyFounding }: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(toggleFoundingSupervisorAction, undefined);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input
        type="hidden"
        name="grant"
        value={currentlyFounding ? "false" : "true"}
      />
      <Button
        type="submit"
        variant={currentlyFounding ? "outline" : "default"}
        size="sm"
        disabled={pending}
      >
        {pending
          ? "…"
          : currentlyFounding
            ? "Revoke"
            : "Grant Founding"}
      </Button>
      {state && state.ok === false && (
        <p className="text-xs text-[color:var(--color-risk)]">{state.error}</p>
      )}
    </form>
  );
}
