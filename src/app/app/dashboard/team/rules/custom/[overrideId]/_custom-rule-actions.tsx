"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deactivateOverrideAction } from "@/app/actions/rule-overrides";

type Props = {
  overrideId: string;
  assignmentCount: number;
};

export function CustomRuleActions({ overrideId, assignmentCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function deactivate() {
    setError(null);
    startTransition(async () => {
      const result = await deactivateOverrideAction({ overrideId });
      if (result.ok) {
        router.push("/dashboard/team/rules");
        router.refresh();
        return;
      }
      setError(result.error);
    });
  }

  if (assignmentCount > 0) {
    return (
      <p className="text-sm text-[color:var(--color-risk)]">
        Cannot deactivate — {assignmentCount}{" "}
        {assignmentCount === 1 ? "supervisee is" : "supervisees are"} still
        assigned this rule.
      </p>
    );
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        Deactivate this custom rule
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground">
        Deactivate this rule? It will disappear from the assignment picker.
        The row stays in the audit trail.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={deactivate}
          disabled={pending}
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          Yes, deactivate
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="text-xs text-[color:var(--color-risk)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
