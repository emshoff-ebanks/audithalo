"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteAccountAction,
  type AccountActionResult,
} from "@/app/actions/account";

export function DeleteAccountForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    AccountActionResult | undefined,
    FormData
  >(deleteAccountAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      // After deletion the JWT is rejected on next request; force a full
      // navigation to /login so the cookie clears.
      router.push("/login");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="delete-password">Password</Label>
        <Input
          id="delete-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Confirm with your current password"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="delete-confirm">
          Type <span className="font-mono">DELETE</span> to confirm
        </Label>
        <Input
          id="delete-confirm"
          name="confirm"
          type="text"
          autoComplete="off"
          required
          placeholder="DELETE"
          className="mt-1.5"
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

      <Button
        type="submit"
        variant="destructive"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  );
}
