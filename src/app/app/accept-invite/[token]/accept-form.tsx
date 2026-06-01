"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptInviteAction,
  type AcceptInviteResult,
} from "@/app/actions/accept-invite";

type Props = {
  token: string;
  email: string;
  suggestedName: string;
};

export function AcceptInviteForm({ token, email, suggestedName }: Props) {
  const [state, formAction, pending] = useActionState<
    AcceptInviteResult | undefined,
    FormData
  >(acceptInviteAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <Label htmlFor="accept-email">Email</Label>
        <Input
          id="accept-email"
          type="email"
          value={email}
          readOnly
          className="mt-2 bg-muted/40 cursor-not-allowed"
        />
      </div>
      <div>
        <Label htmlFor="accept-name">Your full name</Label>
        <Input
          id="accept-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          defaultValue={suggestedName}
          placeholder="Jordan Reyes"
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="accept-password">Choose a password</Label>
        <Input
          id="accept-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          className="mt-2"
        />
      </div>

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Accept invitation"}
      </Button>
    </form>
  );
}
