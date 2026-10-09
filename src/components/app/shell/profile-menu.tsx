"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { LogOut, UserCog, ChevronDown } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABEL, type AppRole } from "./nav-config";

/**
 * Header profile control. Navigation now lives in the sidebar, so this is
 * intentionally lean: identity + Account + Sign out.
 */
export function ProfileMenu({ name, role }: { name: string; role: AppRole }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);
  const roleLabel = ROLE_LABEL[role] ?? role;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--paper-50)] dark:bg-[color:var(--surface-muted)] pl-1 pr-2.5 py-1 hover:border-[color:var(--border-strong)] transition-colors focus-visible:outline-2 focus-visible:outline-[color:var(--halo-yellow)]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name} — account menu`}
      >
        <InitialsAvatar name={name} size="sm" />
        <span className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-[13px] font-semibold text-[color:var(--text-primary)]">{name}</span>
          <span className="text-[11px] text-[color:var(--text-muted)]">{roleLabel}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-[color:var(--text-muted)]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 w-56 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] overflow-hidden"
        >
          <div className="px-3 py-2.5 border-b border-[color:var(--border)]">
            <p className="text-sm font-semibold text-[color:var(--text-primary)] truncate">{name}</p>
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--text-muted)] mt-0.5">{roleLabel}</p>
          </div>
          <ul className="py-1">
            <li>
              <Link
                href="/dashboard/account"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--surface-muted)]"
              >
                <UserCog className="h-4 w-4 text-[color:var(--text-muted)]" />
                Account
              </Link>
            </li>
          </ul>
          <div className="border-t border-[color:var(--border)]">
            <form
              action={() => {
                setOpen(false);
                startTransition(() => logoutAction());
              }}
            >
              <button
                type="submit"
                disabled={pending}
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--surface-muted)] disabled:opacity-60"
              >
                <LogOut className="h-4 w-4 text-[color:var(--text-muted)]" />
                {pending ? "Signing out…" : "Sign out"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
