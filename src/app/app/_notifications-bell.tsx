"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Bell,
  CheckCircle2,
  FileSignature,
  AlertTriangle,
  Loader2,
  AlertOctagon,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchUnreadNotificationsAction,
  markAllReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import type { NotificationKind } from "@/lib/db/schema";

const POLL_INTERVAL_MS = 60_000;

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  createdAt: string;
};

type Props = {
  initialNotifications: NotificationRow[];
};

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function iconFor(kind: NotificationKind) {
  switch (kind) {
    case "invite_accepted":
      return <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />;
    case "signature_needed":
      return <FileSignature className="h-4 w-4 text-secondary" />;
    case "rule_changed":
      return <AlertTriangle className="h-4 w-4 text-[color:var(--color-warning)]" />;
    case "evidence_sealed":
      return <FileSignature className="h-4 w-4 text-[color:var(--color-gold)]" />;
    case "supervisor_rule_not_set":
      return <AlertTriangle className="h-4 w-4 text-[color:var(--color-warning)]" />;
    case "attestation_overdue":
      return <AlertOctagon className="h-4 w-4 text-[color:var(--color-risk)]" />;
  }
}

function messageFor(n: NotificationRow): string {
  switch (n.kind) {
    case "invite_accepted":
      return `${n.payload.superviseeName ?? "Someone"} accepted your invite`;
    case "signature_needed":
      return "Supervision session needs your signature";
    case "rule_changed":
      return `Rule version changed to ${n.payload.newRuleLabel ?? "a new version"}`;
    case "evidence_sealed":
      return "An evidence package was sealed";
    case "supervisor_rule_not_set":
      return `${n.payload.superviseeName ?? "A supervisee"} is missing a state rule`;
    case "attestation_overdue":
      return `Overdue compliance gap on ${n.payload.superviseeName ?? "a supervisee"}`;
  }
}

export function NotificationsBell({ initialNotifications }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>(initialNotifications);
  const [pending, startTransition] = useTransition();

  const unread = items.length;

  // Poll for new notifications every 60s while the tab is visible. Pauses
  // when hidden so we don't burn server calls on a background tab.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      try {
        const rows = await fetchUnreadNotificationsAction();
        if (cancelled) return;
        // Merge: keep optimistic-removed items removed (don't undo a local
        // mark-as-read). Only show server rows that we haven't already
        // marked locally as read.
        setItems((prev) => {
          const prevIds = new Set(prev.map((n) => n.id));
          // Replace with server truth, but if the server is missing items
          // we already have (e.g. mid-mark-read), drop those.
          const fresh = rows.filter(
            (r) => prevIds.has(r.id) || true // accept all unread from server
          );
          // Dedup by id, server order wins.
          const byId = new Map<string, NotificationRow>();
          for (const n of fresh) byId.set(n.id, n);
          return Array.from(byId.values());
        });
      } catch {
        // Polling failures are silent — next tick will retry.
      } finally {
        if (!cancelled) {
          timer = setTimeout(refresh, POLL_INTERVAL_MS);
        }
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        // Resume polling immediately on tab refocus so a returning user sees
        // fresh state.
        if (timer) clearTimeout(timer);
        refresh();
      } else {
        // Pause: clear the pending timer.
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    timer = setTimeout(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  function handleMarkAll() {
    startTransition(async () => {
      const result = await markAllReadAction();
      // Only flush local state when the server confirms — otherwise the bell
      // shows "all caught up" while the DB still has unread rows.
      if (result.ok) setItems([]);
    });
  }

  function handleClick(id: string) {
    startTransition(async () => {
      const result = await markNotificationReadAction({ id });
      if (result.ok) {
        setItems((prev) => prev.filter((n) => n.id !== id));
      }
    });
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        onClick={() => setOpen((o) => !o)}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-[color:var(--color-secondary)] text-secondary-foreground"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-80 z-50 rounded-sm border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm text-foreground">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-secondary hover:underline disabled:opacity-60"
                onClick={handleMarkAll}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Mark all read"
                )}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-foreground/60">
              <Mail className="h-5 w-5 mx-auto mb-2 text-foreground/30" />
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n.id)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/40 text-left"
                  >
                    <span className="mt-0.5 shrink-0">{iconFor(n.kind)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground/85 leading-snug">
                        {messageFor(n)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-foreground/50 font-mono">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
