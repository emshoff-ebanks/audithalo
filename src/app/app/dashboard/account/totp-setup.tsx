"use client";

/**
 * TOTP setup wizard. Two-step UI:
 *   1. "idle"   — show the explanation + an "Enable two-factor" button.
 *   2. "setup"  — call startTotpSetupAction(), render QR + secret + the
 *                 6-digit verification form (enableTotpAction).
 *   3. "backup" — show the 10 plaintext backup codes ONCE; user must
 *                 acknowledge they've saved them.
 *
 * Once the user acknowledges the backup codes, we refresh the page so the
 * server-rendered account page swaps in the "2FA enabled" status card.
 */

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import QRCode from "qrcode";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  enableTotpAction,
  startTotpSetupAction,
  type EnableTotpResult,
} from "@/app/actions/account";

// Local step state. "backup" is derived purely from enableState.ok being
// true — we don't keep duplicate state for it (avoids a useEffect→setState
// cascade that lint correctly flags).
type LocalStep = "idle" | "setup";

export function TotpSetupWizard() {
  const router = useRouter();
  const [localStep, setLocalStep] = useState<LocalStep>("idle");
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [enableState, enableAction, enablePending] = useActionState<
    EnableTotpResult | undefined,
    FormData
  >(enableTotpAction, undefined);

  // Derived: once the server action has confirmed enable, we're on the
  // "show backup codes" step regardless of any local state.
  const step: "idle" | "setup" | "backup" = enableState?.ok
    ? "backup"
    : localStep;

  async function handleStart() {
    setStartError(null);
    setStarting(true);
    try {
      const result = await startTotpSetupAction();
      if (!result.ok) {
        setStartError(result.error);
        return;
      }
      setSecret(result.secret);
      setUri(result.otpAuthUri);
      setLocalStep("setup");
    } finally {
      setStarting(false);
    }
  }

  function handleDone() {
    // Force a router refresh so the server component re-renders with the
    // new "2FA active" status card.
    router.refresh();
  }

  if (step === "idle") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground/70">
          Add a second factor to your sign-in. After enabling, you&apos;ll need
          your password AND a 6-digit code from an authenticator app (Google
          Authenticator, 1Password, Authy, etc.) to log in.
        </p>
        {startError && (
          <p
            role="alert"
            className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
          >
            {startError}
          </p>
        )}
        <Button onClick={handleStart} disabled={starting}>
          <ShieldCheck className="h-4 w-4" />
          {starting ? "Setting up…" : "Enable two-factor"}
        </Button>
      </div>
    );
  }

  if (step === "setup" && secret && uri) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-sm text-foreground/70 mb-3">
            1. Scan this QR code in your authenticator app — or paste the secret
            below if you can&apos;t scan.
          </p>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <TotpQrCode uri={uri} />
            <div className="flex-1 space-y-1.5">
              <Label className="label-overline">Secret</Label>
              <code className="block break-all rounded-sm bg-muted px-2.5 py-1.5 text-xs font-mono">
                {secret}
              </code>
              <p className="text-xs text-foreground/55">
                Account: AuditHalo
              </p>
            </div>
          </div>
        </div>

        <form action={enableAction} className="space-y-3 border-t pt-4">
          <input type="hidden" name="secret" value={secret} />
          <div>
            <Label htmlFor="totp-verify-code">
              2. Enter the 6-digit code from your app
            </Label>
            <Input
              id="totp-verify-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              className="mt-2 font-mono tracking-widest max-w-[12rem]"
            />
          </div>

          {enableState?.ok === false && (
            <p
              role="alert"
              className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
            >
              {enableState.error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={enablePending}>
              {enablePending ? "Verifying…" : "Verify and enable"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLocalStep("idle");
                setSecret(null);
                setUri(null);
              }}
              disabled={enablePending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (step === "backup" && enableState?.ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-sm border border-[color:var(--color-warn)]/30 bg-[color:var(--color-warn)]/8 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-[color:var(--color-warn)]" />
            Save these backup codes now
          </p>
          <p className="mt-1.5 text-xs text-foreground/70">
            Each code can be used once if you lose your authenticator device.
            We won&apos;t show them again — store them somewhere safe (a
            password manager works well).
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-1.5 rounded-sm bg-muted p-3 font-mono text-sm sm:grid-cols-2">
          {enableState.backupCodes.map((code) => (
            <li key={code} className="py-0.5">
              {code}
            </li>
          ))}
        </ul>
        <Button onClick={handleDone}>I&apos;ve saved my backup codes</Button>
      </div>
    );
  }

  return null;
}

/** Renders the otpauth:// URI as a QR code via the `qrcode` library. */
function TotpQrCode({ uri }: { uri: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(uri, { width: 192, margin: 1 })
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (!dataUrl) {
    return <div className="h-48 w-48 rounded-sm bg-muted" />;
  }
  return (
    // next/image doesn't play nicely with data URIs and this is a one-shot
    // setup screen — a plain <img> is fine here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="TOTP setup QR code"
      className="h-48 w-48 rounded-sm border bg-white p-1"
    />
  );
}
