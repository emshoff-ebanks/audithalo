"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  promoteOrgToEnterpriseAction,
  type AdminEnterpriseResult,
} from "@/app/actions/admin-enterprise";

type Props = {
  orgId: string;
  orgName: string;
  ownerEmail: string;
};

export function PromoteToEnterpriseForm({
  orgId,
  orgName,
  ownerEmail,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<
    AdminEnterpriseResult | undefined,
    FormData
  >(promoteOrgToEnterpriseAction, undefined);

  if (state?.ok) {
    return <span className="text-xs text-foreground/60">Promoted</span>;
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setConfirming(true)}
      >
        Promote to Enterprise
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 text-left">
      <input type="hidden" name="orgId" value={orgId} />
      <p className="text-xs text-foreground/80">
        Promote <strong>{orgName}</strong> to Enterprise. Owner&apos;s account
        ({ownerEmail}) flips to HR Admin if currently Supervisor. Welcome email
        sent.
      </p>
      <p className="text-xs text-[color:var(--color-warning)] border-l-2 border-[color:var(--color-warning)] pl-2">
        <strong>Heads up:</strong> if the owner has active supervisees, those
        become unassigned after this flip. They&apos;ll need to invite another
        supervisor (or use Solo-era account) and reassign each supervisee
        before clinical signing resumes.
      </p>
      {state && state.ok === false && (
        <p
          role="alert"
          className="text-xs text-[color:var(--color-risk)]"
        >
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          variant="destructive"
          disabled={pending}
        >
          {pending ? "…" : "Confirm"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
