"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, X, CheckCircle2, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  applyRuleVersionAction,
  dismissRuleChangeAction,
} from "@/app/actions/rules";

type Props = {
  assignmentId: string;
  currentLabel: string;
  newRuleId: string;
  newLabel: string;
  viewerCanSupervise: boolean;
  /** Set when this org has an active override on the *current* canonical
   *  rule. When set, the banner exposes the third "switch + re-author"
   *  option so the user doesn't silently lose their org policy on v2. */
  currentOverrideId?: string | null;
};

/**
 * Surfaced on the supervisee detail page when the assignment's rule version
 * is older than the latest available for its (state, license) pair. The
 * supervisor can apply the new version, snooze the prompt for 30 days, or
 * (when an active org override exists on the current version) switch and
 * re-author the override on top of the new canonical.
 */
export function RuleVersionBanner({
  assignmentId,
  currentLabel,
  newRuleId,
  newLabel,
  viewerCanSupervise,
  currentOverrideId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hasOverride = !!currentOverrideId;

  if (dismissed) return null;

  function handleApply() {
    setError(null);
    startTransition(async () => {
      const result = await applyRuleVersionAction({
        assignmentId,
        newRuleId,
      });
      if (result.ok) {
        setApplied(true);
        // Re-fetch the server components so the page reflects the new
        // ruleId everywhere (rule label, version-drift banner removal,
        // re-evaluated compliance). Without this, the banner sticks on
        // "Applied — refreshing" until the user manually reloads.
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleReauthor() {
    setError(null);
    startTransition(async () => {
      const result = await applyRuleVersionAction({
        assignmentId,
        newRuleId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Land on the override editor for the new canonical, pre-filled with
      // the v1 override values. The page handles the prefill behind the
      // reauthor_from query param.
      router.push(
        `/dashboard/team/rules/${newRuleId}?reauthor_from=${currentOverrideId}`
      );
    });
  }

  function handleDismiss() {
    setError(null);
    startTransition(async () => {
      const result = await dismissRuleChangeAction({ assignmentId });
      if (result.ok) {
        setDismissed(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-10 rounded-sm border border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/5 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          <RefreshCw
            className="h-5 w-5 shrink-0 text-[color:var(--color-warning)] mt-0.5"
            strokeWidth={1.75}
          />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-foreground">
              A newer rule version is available.
            </p>
            <p className="mt-1 text-sm text-foreground/75">
              This supervisee is tracked against{" "}
              <span className="font-medium text-foreground">{currentLabel}</span>.
              The state board has since published{" "}
              <span className="font-medium text-foreground">{newLabel}</span>.
            </p>
            {hasOverride && viewerCanSupervise && (
              <p className="mt-1 text-xs text-foreground/60">
                Your org has an active override on {currentLabel}. Overrides
                are version-bound &mdash; switching to {newLabel} drops the
                override unless you re-author it on top of the new canonical.
              </p>
            )}
            {!hasOverride && viewerCanSupervise && (
              <p className="mt-1 text-xs text-foreground/60">
                Applying the new version re-evaluates this supervisee&apos;s
                logged hours against the updated rule. Hours stay in place;
                only the compliance check changes.
              </p>
            )}
            {!viewerCanSupervise && (
              <p className="mt-1 text-xs text-foreground/60">
                Your supervisor can apply the new version. Reach out if they
                haven&apos;t already.
              </p>
            )}
          </div>
        </div>
        {viewerCanSupervise && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {applied ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-success)]/10 px-3 py-1.5 text-xs font-medium text-[color:var(--color-success)]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Applied — refreshing
              </span>
            ) : (
              <>
                {hasOverride && (
                  <Button
                    size="sm"
                    onClick={handleReauthor}
                    disabled={pending}
                  >
                    {pending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <GitMerge className="h-3.5 w-3.5" />
                        Switch &amp; re-author override
                      </>
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={hasOverride ? "outline" : "default"}
                  onClick={handleApply}
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      {hasOverride
                        ? `Switch to canonical ${newLabel}`
                        : `Apply ${newLabel}`}
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismiss}
                  disabled={pending}
                >
                  <X className="h-3.5 w-3.5" />
                  Keep on {currentLabel}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 text-xs text-[color:var(--color-risk)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
