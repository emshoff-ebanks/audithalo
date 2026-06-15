"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX, Loader2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelScheduledSessionAction,
  markSessionNoShowAction,
  type ActionResult,
} from "@/app/actions/sessions";

type Props = {
  sessionId: string;
  /** Whether the viewer is also the supervisee — they can mark no-show
   *  but not cancel a session that was already supposed to happen. */
  canCancel: boolean;
};

/**
 * Post-meeting "This didn't happen" escape hatch on the sign screen.
 *
 * Lives below the sign form for sessions whose end time has passed but
 * weren't actually delivered (no one joined, supervisor missed it, etc.).
 * Replaces the prior model where the daily cron auto-flipped these to
 * no_show. Now: the human says what happened, and the audit log records
 * who said it.
 *
 * Two distinct outcomes, chosen explicitly so the audit trail stays
 * truthful:
 *   - Cancel — "It didn't run at all" (e.g. supervisor canceled last
 *     minute, never started the meeting). Closes the row.
 *   - No-show — "It started but no one attended" (e.g. supervisee never
 *     joined the call). The row stays as a no-show on the supervisee's
 *     compliance trail.
 */
export function DidntHappenAffordance({ sessionId, canCancel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function dispatch(
    fn: typeof cancelScheduledSessionAction | typeof markSessionNoShowAction
  ) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      const result: ActionResult | undefined = await fn(undefined, fd);
      if (result?.ok) {
        router.refresh();
        setOpen(false);
        return;
      }
      setError(result?.error ?? "Couldn't update the session.");
    });
  }

  if (!open) {
    return (
      <div className="pt-4 border-t border-border">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-foreground/60 underline hover:text-foreground"
        >
          This session didn&apos;t happen
        </button>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-border space-y-3">
      <p className="text-sm text-foreground">
        Pick what happened. The row stays in the audit log either way; the
        compliance picture for your supervisee is different.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => dispatch(cancelScheduledSessionAction)}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarX className="h-3.5 w-3.5" />
            )}
            It was canceled (didn&apos;t run)
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => dispatch(markSessionNoShowAction)}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserX className="h-3.5 w-3.5" />
          )}
          Mark no-show (no one attended)
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Never mind
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
