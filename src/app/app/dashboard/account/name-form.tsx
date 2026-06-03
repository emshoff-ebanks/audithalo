"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateNameAction,
  type AccountActionResult,
} from "@/app/actions/account";

type Props = {
  currentName: string;
};

export function NameForm({ currentName }: Props) {
  const [state, formAction, pending] = useActionState<
    AccountActionResult | undefined,
    FormData
  >(updateNameAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="account-name">Full name</Label>
        <Input
          id="account-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          defaultValue={currentName}
          className="mt-2"
        />
      </div>

      {state && state.ok === true && state.message && (
        <p
          role="status"
          className="text-sm text-foreground bg-secondary/8 px-3 py-2 rounded-sm"
        >
          {state.message}
        </p>
      )}
      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}
