"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { updateAutoApplyRuleUpdatesAction } from "@/app/actions/rules";

const SAVED_TOAST_MS = 3500;

export function CompliancePrefsForm({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  // Optimistic local state — flips immediately so the toggle feels snappy,
  // reverts on server failure.
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [showSaved, setShowSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function handleToggle() {
    const next = !enabled;
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      const result = await updateAutoApplyRuleUpdatesAction({ enabled: next });
      if (result.ok) {
        setShowSaved(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setShowSaved(false), SAVED_TOAST_MS);
      } else {
        // Revert on failure.
        setEnabled(previous);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-foreground font-medium">
            Auto-apply rule updates to my supervisees
          </p>
          <p className="mt-0.5 text-xs text-foreground/60">
            When a state board publishes a new rule version, automatically
            switch every one of your supervisees to it and send you a heads-up
            email. If left off, you&apos;ll get a notification with a link to
            apply each one yourself.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Auto-apply rule updates"
            disabled={pending}
            onClick={handleToggle}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              enabled
                ? "bg-[color:var(--color-secondary)]"
                : "bg-muted"
            } disabled:opacity-60`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
            {pending && (
              <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-white/80" />
            )}
          </button>
        </div>
      </div>
      {showSaved && (
        <span
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-success)]/10 px-2.5 py-1 text-xs font-medium text-[color:var(--color-success)]"
        >
          <Check className="h-3 w-3" />
          Saved
        </span>
      )}
    </div>
  );
}
