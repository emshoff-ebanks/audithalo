"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

/**
 * Reads `?connected=microsoft|google` or `?error=...` after the OAuth
 * callback redirects back to /dashboard/account. Renders a one-shot
 * banner, then clears the params from the URL so a page refresh doesn't
 * re-show it.
 */
export function IntegrationsResultBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const connected = params.get("connected");
  const error = params.get("error");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Strip the params from the URL on mount so a refresh is clean.
    if (connected || error) {
      const next = new URLSearchParams(params.toString());
      next.delete("connected");
      next.delete("error");
      next.delete("error_detail");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}#integrations` : `${pathname}#integrations`, {
        scroll: false,
      });
    }
    // We intentionally only react to the initial mount — replacing the URL
    // would otherwise re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;
  if (!connected && !error) return null;

  if (connected) {
    const label =
      connected === "microsoft"
        ? "Microsoft (Teams + Outlook)"
        : connected === "google"
          ? "Google (Meet + Calendar)"
          : connected;
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-md border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/5 p-3 text-sm"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--color-success)]" />
        <p className="flex-1 text-foreground/80">
          <span className="font-medium text-foreground">{label}</span>{" "}
          connected. Scheduling and meeting links are ready to go.
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          className="text-foreground/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const humanError = friendlyOAuthError(error ?? "");
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5 p-3 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 text-[color:var(--color-risk)]" />
      <div className="flex-1 text-foreground/80">
        <p>
          {humanError}{" "}
          {humanError.endsWith(".") ? "" : "."}{" "}
          Try again — if it keeps failing, email{" "}
          <a href="mailto:info@audithalo.com" className="underline">
            info@audithalo.com
          </a>
          .
        </p>
        <details className="mt-2 text-xs text-foreground/50">
          <summary className="cursor-pointer select-none">
            Technical details
          </summary>
          <p className="font-mono mt-1">{error}</p>
        </details>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="text-foreground/60 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Map known OAuth error codes from /api/auth/{provider}/callback to
 * human-readable copy. Unknown codes fall through to a generic message —
 * the raw code stays visible in the "Technical details" disclosure.
 */
function friendlyOAuthError(code: string): string {
  if (code.endsWith("_state_mismatch")) {
    return "Your sign-in session expired before the connection finished. Start the connect from Account → Integrations again.";
  }
  if (code.endsWith("_missing_code")) {
    return "The provider returned without a consent code — that usually means consent was canceled.";
  }
  if (code.endsWith("_token_exchange_failed")) {
    return "We couldn't redeem the consent code with the provider. The provider may be temporarily unavailable, or the redirect URI in our app registration is out of date.";
  }
  if (code.endsWith("_access_denied")) {
    return "Consent was denied. To connect this calendar you need to approve every calendar + meeting scope we ask for.";
  }
  if (code.endsWith("_consent_required")) {
    return "Your IT admin needs to grant tenant-wide consent before this calendar can be connected.";
  }
  return "We couldn't finish connecting that account.";
}
