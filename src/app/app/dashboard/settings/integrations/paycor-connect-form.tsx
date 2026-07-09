"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initiatePaycorOAuthAction,
  type InitiateOAuthResult,
} from "@/app/actions/paycor-config";

export function PaycorConnectForm() {
  const [result, setResult] = useState<InitiateOAuthResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConnect(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await initiatePaycorOAuthAction(undefined, formData);
      if (res.ok) {
        window.location.href = res.redirectUrl;
      } else {
        setResult(res);
      }
    });
  }

  return (
    <form className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pc-legal-entity-id">Legal Entity ID</Label>
          <Input
            id="pc-legal-entity-id"
            name="legalEntityId"
            placeholder="e.g. 500123"
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="pc-environment">Environment</Label>
          <select
            id="pc-environment"
            name="environment"
            className="mt-1.5 flex h-9 w-full rounded-sm border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            defaultValue="sandbox"
          >
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="pc-apim-key">APIM Subscription Key</Label>
        <Input
          id="pc-apim-key"
          name="apimSubscriptionKey"
          type="password"
          required
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-foreground/50">
          From the Paycor Developer Portal under your application&apos;s API
          Management subscriptions.
        </p>
      </div>

      {result && !result.ok && (
        <p
          role="status"
          className="text-sm px-3 py-2 rounded-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8"
        >
          {result.error}
        </p>
      )}

      <div className="pt-1">
        <Button type="submit" formAction={handleConnect} disabled={isPending}>
          {isPending ? (
            "Redirecting..."
          ) : (
            <>
              Connect to Paycor
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
