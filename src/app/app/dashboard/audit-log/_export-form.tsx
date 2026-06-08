"use client";

import { useActionState, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  prepareAuditLogExport,
  type ExportPrepareResult,
} from "@/app/actions/audit-log-export";

type Props = {
  /** True when the signed-in user must enter a TOTP code to export. */
  requireTotp: boolean;
};

/**
 * Two-button export with inline TOTP for HR Admin. On success the server
 * returns a one-time token and we redirect to the streaming route.
 * Executive's flow is one-click — no TOTP modal at all.
 */
export function AuditLogExportForm({ requireTotp }: Props) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [state, formAction, pending] = useActionState<
    ExportPrepareResult | undefined,
    FormData
  >(prepareAuditLogExport, undefined);

  useEffect(() => {
    if (state?.ok && state.token) {
      // Token TTL is 60s on the server; this download fires immediately.
      window.location.href = `/api/audit-log/export?token=${encodeURIComponent(state.token)}`;
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="format" value={format} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={format === "csv" ? "default" : "outline"}
          size="sm"
          onClick={() => setFormat("csv")}
        >
          CSV
        </Button>
        <Button
          type="button"
          variant={format === "json" ? "default" : "outline"}
          size="sm"
          onClick={() => setFormat("json")}
        >
          JSON
        </Button>
      </div>

      {requireTotp && (
        <div>
          <Label htmlFor="audit-totp">2FA code</Label>
          <Input
            id="audit-totp"
            name="totpCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="123456"
            className="mt-1.5 font-mono tracking-widest max-w-[200px]"
          />
          <p className="mt-1 text-xs text-foreground/60">
            Exporting the org-wide audit log is a sensitive action.
            Enter your 2FA code (or an 8-character backup code) to confirm.
          </p>
        </div>
      )}

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing…
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Export {format.toUpperCase()}
          </>
        )}
      </Button>
    </form>
  );
}
