"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deactivateOverrideAction } from "@/app/actions/rule-overrides";

type Props = {
  overrideId: string;
  /** Server-rendered diff content; child is shown when "View diff" is expanded. */
  diffSlot: ReactNode;
};

/**
 * Per-row actions for an active canonical override on the rules dashboard.
 * Server-renders the diff content; this component just toggles its
 * visibility and owns the deactivate confirm flow.
 */
export function OverrideRowActions({ overrideId, diffSlot }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDiff, setShowDiff] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function deactivate() {
    setError(null);
    startTransition(async () => {
      const result = await deactivateOverrideAction({ overrideId });
      if (result.ok) {
        setConfirming(false);
        router.refresh();
        return;
      }
      setError(result.error);
    });
  }

  return (
    <div className="space-y-2 w-full">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowDiff((s) => !s)}
        >
          {showDiff ? "Hide diff" : "View diff"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming((c) => !c)}
        >
          {confirming ? "Cancel" : "Deactivate"}
        </Button>
      </div>

      {showDiff && (
        <div className="rounded-sm border border-border bg-card p-3 text-xs">
          {diffSlot}
        </div>
      )}

      {confirming && (
        <div className="rounded-sm border border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5 p-3 space-y-2">
          <p className="text-xs text-foreground">
            Deactivate this override? Your org will go back to the standard
            board rule for this license, across every supervisee. The history
            of your customization stays in the audit trail.
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
      )}
    </div>
  );
}
