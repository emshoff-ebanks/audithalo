"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const HASH_RE = /[?&]hash=([0-9a-f]{64})/i;

/**
 * Public verify search. Accepts a bare package ID (UUID) or a full verify URL
 * (with optional ?hash=…) pasted from a sealed PDF, and routes to
 * /verify/<id>[?hash=…]. Bare paths mirror the rest of marketing (the proxy
 * maps the marketing host onto /marketing/*), so /verify/<id> resolves.
 */
export function VerifySearch({
  defaultValue = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = value.trim();
    const id = input.match(UUID_RE)?.[0];
    if (!id) {
      setError("That doesn't look like an evidence package ID or verify link.");
      return;
    }
    const hash = input.match(HASH_RE)?.[1];
    router.push(`/verify/${id.toLowerCase()}${hash ? `?hash=${hash}` : ""}`);
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex items-center gap-2 rounded-[10px] border border-[color:var(--ink-200)] bg-[color:var(--paper-100)] py-1.5 pl-3.5 pr-1.5">
        <Search
          className="h-4 w-4 shrink-0 text-[color:var(--ink-400)]"
          strokeWidth={2}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          autoFocus={autoFocus}
          spellCheck={false}
          aria-label="Evidence package ID or verify URL"
          placeholder="Enter a package ID or paste the verify URL"
          className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-sm text-[color:var(--ink-900)] placeholder:text-[color:var(--ink-400)] outline-none"
        />
        <Button type="submit" size="sm" className="shrink-0">
          Verify
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-[color:var(--risk-700)]">{error}</p>
      )}
    </form>
  );
}
