"use client";

import { useTransition, useState } from "react";
import { Loader2 } from "lucide-react";
import { setPreferredCalendarIntegrationAction } from "@/app/actions/calendar-integrations";

export function IntegrationPreferredButton({
  provider,
}: {
  provider: "microsoft" | "google";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await setPreferredCalendarIntegrationAction(provider);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-accent disabled:opacity-50 transition-colors"
      >
        {pending && <Loader2 className="h-3 w-3 animate-spin" />}
        Set as preferred
      </button>
      {error && (
        <p className="text-xs text-[color:var(--color-risk)]">{error}</p>
      )}
    </div>
  );
}
