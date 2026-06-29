"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  acceptInviteAsExistingUserAction,
  type AcceptInviteResult,
} from "@/app/actions/accept-invite";

type Props = {
  token: string;
  email: string;
};

export function AcceptAsExistingUserForm({ token, email }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    AcceptInviteResult | undefined,
    FormData
  >(acceptInviteAsExistingUserAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      router.push("/dashboard");
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-foreground/70">
        Accepting will add this supervisor&apos;s organization to your account
        ({email}). Your existing data stays unchanged.
      </p>

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Accepting…" : "Accept invitation"}
      </Button>
    </form>
  );
}
