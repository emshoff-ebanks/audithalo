"use client";

import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutEverywhereAction } from "@/app/actions/account";

type Result = { ok: true } | { ok: false; error: string };

export function SignOutEverywhereButton() {
  const [state, formAction, pending] = useActionState<
    Result | undefined,
    FormData
  >(signOutEverywhereAction, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !confirm(
            "Sign out of every device where this account is signed in? You'll be signed out of THIS device too."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        <LogOut className="h-3.5 w-3.5" />
        {pending ? "Signing out everywhere…" : "Sign out everywhere"}
      </Button>
      {state && state.ok === false && (
        <p
          role="alert"
          className="mt-2 text-sm text-[color:var(--color-risk)]"
        >
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mt-2 text-sm text-[color:var(--color-success)]">
          Signed out of all sessions. You&apos;ll be redirected to the login
          page on next navigation.
        </p>
      )}
    </form>
  );
}
