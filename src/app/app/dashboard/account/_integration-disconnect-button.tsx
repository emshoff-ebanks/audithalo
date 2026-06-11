"use client";

import { useTransition, useState } from "react";
import { Loader2 } from "lucide-react";
import { disconnectCalendarIntegrationAction } from "@/app/actions/calendar-integrations";

export function IntegrationDisconnectButton({
  provider,
}: {
  provider: "microsoft" | "google";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    if (
      !window.confirm(
        `Disconnect ${provider === "microsoft" ? "Microsoft" : "Google"}? You can reconnect anytime.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await disconnectCalendarIntegrationAction(provider);
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
        Disconnect
      </button>
      {error && (
        <p className="text-xs text-[color:var(--color-risk)]">{error}</p>
      )}
    </div>
  );
}
