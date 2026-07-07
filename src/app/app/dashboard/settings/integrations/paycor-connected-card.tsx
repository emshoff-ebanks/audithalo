"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { PaycorConfig } from "@/lib/db/schema";
import { disconnectPaycorAction } from "@/app/actions/paycor-config";

export function PaycorConnectedCard({ config }: { config: PaycorConfig }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectPaycorAction();
    });
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-foreground/50">Legal Entity ID</dt>
          <dd className="font-medium">{config.legalEntityId}</dd>
        </div>
        <div>
          <dt className="text-foreground/50">Environment</dt>
          <dd className="font-medium capitalize">{config.environment}</dd>
        </div>
        <div>
          <dt className="text-foreground/50">Connected</dt>
          <dd className="font-medium">
            {new Date(config.connectedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </dd>
        </div>
        {config.lastSyncAt && (
          <div>
            <dt className="text-foreground/50">Last sync</dt>
            <dd className="font-medium">
              {new Date(config.lastSyncAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {config.lastSyncStatus && (
                <span
                  className={`ml-1.5 text-xs ${
                    config.lastSyncStatus === "success"
                      ? "text-[color:var(--color-success)]"
                      : config.lastSyncStatus === "failed"
                        ? "text-[color:var(--color-risk)]"
                        : "text-[color:var(--color-warning)]"
                  }`}
                >
                  ({config.lastSyncStatus})
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>

      <div className="pt-2 border-t border-border">
        {!showConfirm ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfirm(true)}
            className="text-[color:var(--color-risk)]"
          >
            Disconnect
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm text-foreground/70">
              This will stop roster sync and document delivery.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isPending}
              className="text-[color:var(--color-risk)] border-[color:var(--color-risk)]/30 shrink-0"
            >
              {isPending ? "Disconnecting..." : "Confirm disconnect"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
              className="shrink-0"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
