"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  connectPaycorAction,
  testPaycorConnectionAction,
  type PaycorConfigResult,
} from "@/app/actions/paycor-config";

export function PaycorConnectForm() {
  const [result, setResult] = useState<PaycorConfigResult | null>(null);
  const [testResult, setTestResult] = useState<PaycorConfigResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConnect(formData: FormData) {
    setResult(null);
    setTestResult(null);
    startTransition(async () => {
      const res = await connectPaycorAction(undefined, formData);
      setResult(res);
    });
  }

  function handleTest(formData: FormData) {
    setTestResult(null);
    setResult(null);
    startTransition(async () => {
      const res = await testPaycorConnectionAction(undefined, formData);
      setTestResult(res);
    });
  }

  const feedback = testResult ?? result;

  return (
    <form className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pc-legal-entity-id">Legal Entity ID</Label>
          <Input
            id="pc-legal-entity-id"
            name="legalEntityId"
            placeholder="e.g. 123456"
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pc-client-id">OAuth Client ID</Label>
          <Input
            id="pc-client-id"
            name="oauthClientId"
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="pc-client-secret">OAuth Client Secret</Label>
          <Input
            id="pc-client-secret"
            name="oauthClientSecret"
            type="password"
            required
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="pc-refresh-token">OAuth Refresh Token</Label>
        <Input
          id="pc-refresh-token"
          name="oauthRefreshToken"
          type="password"
          required
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-foreground/50">
          From the Paycor Developer Portal under your application&apos;s
          security connections.
        </p>
      </div>

      {feedback && (
        <p
          role="status"
          className={`text-sm px-3 py-2 rounded-sm ${
            feedback.ok
              ? "text-[color:var(--color-success)] bg-[color:var(--color-success)]/8"
              : "text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8"
          }`}
        >
          {feedback.ok ? feedback.message : feedback.error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="submit" formAction={handleConnect} disabled={isPending}>
          {isPending ? "Working..." : "Connect"}
        </Button>
        <Button
          type="submit"
          formAction={handleTest}
          variant="outline"
          disabled={isPending}
        >
          {isPending ? "Working..." : "Test connection"}
        </Button>
      </div>
    </form>
  );
}
