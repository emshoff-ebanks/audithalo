"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Save, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateCredentialsAction,
  type AccountActionResult,
} from "@/app/actions/account";

const SAVED_TOAST_MS = 3500;

export function CredentialsForm({
  initialCredentials,
}: {
  initialCredentials: string[] | null;
}) {
  const [state, formAction, pending] = useActionState<
    AccountActionResult | undefined,
    FormData
  >(updateCredentialsAction, undefined);

  const [showSaved, setShowSaved] = useState(false);
  const lastResultRef = useRef<AccountActionResult | undefined>(undefined);
  useEffect(() => {
    if (state && state !== lastResultRef.current && state.ok === true) {
      lastResultRef.current = state;
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), SAVED_TOAST_MS);
      return () => clearTimeout(t);
    }
    lastResultRef.current = state;
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="credentials">Your credentials (comma-separated)</Label>
        <Input
          id="credentials"
          name="credentials"
          type="text"
          defaultValue={initialCredentials?.join(", ") ?? ""}
          placeholder="e.g. LCMHCS, NCC, LPC"
          className="mt-2"
        />
        <p className="mt-1.5 text-xs text-foreground/60">
          These auto-populate when you log supervision sessions and are checked
          against your supervisees&apos; state requirements. Enter each credential
          separated by a comma.
        </p>
      </div>

      {state && !state.ok && (
        <p className="flex items-center gap-1.5 text-sm text-[color:var(--color-risk)]">
          <AlertTriangle className="h-3.5 w-3.5" />
          {state.error}
        </p>
      )}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? (
          "Saving..."
        ) : showSaved ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Saved
          </>
        ) : (
          <>
            <Save className="h-3.5 w-3.5" />
            Save credentials
          </>
        )}
      </Button>
    </form>
  );
}
