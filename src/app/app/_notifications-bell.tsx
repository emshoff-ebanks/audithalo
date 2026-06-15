"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  FileSignature,
  AlertTriangle,
  Loader2,
  AlertOctagon,
  Mail,
  CreditCard,
  CalendarClock,
  CalendarX,
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
    case "trial_ending_soon":
      return <CreditCard className="h-4 w-4 text-[color:var(--color-warning)]" />;
    case "session_scheduled":
      return <CalendarClock className="h-4 w-4 text-secondary" />;
    case "session_canceled":
      return <CalendarX className="h-4 w-4 text-[color:var(--color-warning)]" />;
    case "session_rescheduled":
      return <CalendarClock className="h-4 w-4 text-[color:var(--color-warning)]" />;
    case "session_reminder_1hour":
    case "session_reminder_15min":
      return <CalendarClock className="h-4 w-4 text-secondary" />;
    case "session_no_show":
      return <AlertOctagon className="h-4 w-4 text-[color:var(--color-risk)]" />;
    case "session_sign_reminder":
      return <FileSignature className="h-4 w-4 text-[color:var(--color-warning)]" />;
  }
}

function messageFor(n: NotificationRow): string {
  const sup = (n.payload.superviseeName as string | undefined) ?? null;
  const sessionDate = (n.payload.sessionDate as string | undefined) ?? null;
  const sessionType = (n.payload.sessionType as string | undefined) ?? null;
  const hours = n.payload.durationHours as number | undefined;
  const sessionSuffix = [
    sessionType ? `${sessionType} session` : null,
    sessionDate ? sessionDate.slice(0, 10) : null,
    typeof hours === "number" ? `${hours.toFixed(1)} hr` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  switch (n.kind) {
    case "invite_accepted":
      return `${sup ?? "Someone"} accepted your invite`;
    case "signature_needed":
      // The original "Supervision session needs your signature" carried no
      // context — a supervisor with two supervisees couldn't tell who from
      // the bell alone. Now: name + date + hours when available.
      return sup
        ? `${sup} needs your signature${sessionSuffix ? ` — ${sessionSuffix}` : ""}`
        : `Supervision session needs your signature${sessionSuffix ? ` — ${sessionSuffix}` : ""}`;
    case "rule_changed":
      return `Rule version changed to ${n.payload.newRuleLabel ?? "a new version"}`;
    case "evidence_sealed":
      // Same rationale — name plus the session this packet is for.
      return sup
        ? `Evidence package sealed for ${sup}${sessionSuffix ? ` — ${sessionSuffix}` : ""}`
        : `An evidence package was sealed${sessionSuffix ? ` — ${sessionSuffix}` : ""}`;
    case "supervisor_rule_not_set":
      return `${sup ?? "A supervisee"} is missing a state rule`;
    case "attestation_overdue":
      return `Overdue compliance gap on ${sup ?? "a supervisee"}`;
    case "trial_ending_soon":
      return `Your trial ends in ${n.payload.daysLeft ?? 3} days`;
    case "session_scheduled":
      return sup
        ? `Supervision scheduled with ${sup} — ${n.payload.scheduledForLocal ?? "a future time"}`
        : `Supervision scheduled for ${n.payload.scheduledForLocal ?? "a future time"}`;
    case "session_canceled":
      return `Supervision canceled (${n.payload.scheduledForLocal ?? "scheduled session"})`;
    case "session_rescheduled":
      return `Supervision moved to ${n.payload.newScheduledForLocal ?? "a new time"}`;
    case "session_reminder_1hour":
      return `Supervision in 1 hour — ${n.payload.scheduledForLocal ?? "scheduled session"}`;
    case "session_reminder_15min":
      return `Supervision in 15 minutes — ${n.payload.scheduledForLocal ?? "starting soon"}`;
    case "session_no_show":
      return `No-show flagged — ${sup ?? "a supervisee"}`;
    case "session_sign_reminder":
      return sup
        ? `Sign your session with ${sup}${sessionSuffix ? ` — ${sessionSuffix}` : ""}`
        : `Sign your supervision session${sessionSuffix ? ` — ${sessionSuffix}` : ""}`;
  }
}

/**
 * Where the user lands when they click a notification row. Returns null
 * for kinds without a single obvious destination — those just mark-read
 * and don't navigate.
 */
function destinationFor(n: NotificationRow): string | null {
  const sessionId = n.payload.sessionId as string | undefined;
  const superviseeId = n.payload.superviseeId as string | undefined;
  const packageId = n.payload.packageId as string | undefined;
  switch (n.kind) {
    case "invite_accepted":
      return superviseeId
        ? `/dashboard/roster/${superviseeId}`
        : "/dashboard/roster";
    case "signature_needed":
    case "session_scheduled":
    case "session_rescheduled":
    case "session_reminder_1hour":
    case "session_reminder_15min":
    case "session_no_show":
    case "session_sign_reminder":
      return sessionId ? `/sign/${sessionId}` : null;
    case "session_canceled":
      return superviseeId
        ? `/dashboard/roster/${superviseeId}`
        : "/dashboard/roster";
    case "rule_changed":
    case "supervisor_rule_not_set":
    case "attestation_overdue":
      return superviseeId
        ? `/dashboard/roster/${superviseeId}`
        : "/dashboard/roster";
    case "evidence_sealed":
      // Take them straight to the package detail (PDF download lives
      // inside the supervisee detail row). Falling back to roster.
      return superviseeId
        ? `/dashboard/roster/${superviseeId}#evidence`
        : packageId
          ? `/dashboard/roster`
          : "/dashboard";
    case "trial_ending_soon":
      return "/dashboard/billing";
  }
}

export function NotificationsBell({ initialNotifications }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>(initialNotifications);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Tracks notification ids the user has locally dismissed (via click or
  // "Mark all read") so a subsequent 60s poll doesn't re-inflate them while
  // the server-side mark-read is still in flight. Bounded by session length.
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  const unread = items.length;

  // Mirror the avatar dropdown's UX: clicking anywhere outside the bell
  // popover or pressing Escape closes it. Avoids the trap where a user
  // has to click the bell again to dismiss.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
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

  // Poll for new notifications every 60s while the tab is visible. Pauses
  // when hidden so we don't burn server calls on a background tab.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      try {
        const rows = await fetchUnreadNotificationsAction();
        if (cancelled) return;
        // Honor local dismissals — a row the user clicked or "Mark all
        // read"-ed must not flicker back into the bell while the server
        // catches up. Once the server has actually marked the row read,
        // it stops appearing in fetchUnreadNotificationsAction and the
        // dismissed entry can stay in the ref harmlessly.
        setItems(() => {
          const fresh = rows.filter((r) => !dismissedIdsRef.current.has(r.id));
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
    // Snapshot the ids currently shown so the upcoming poll can't undo
    // the mark-all-read between now and the server commit.
    const currentIds = items.map((n) => n.id);
    startTransition(async () => {
      const result = await markAllReadAction();
      // Only flush local state when the server confirms — otherwise the bell
      // shows "all caught up" while the DB still has unread rows.
      if (result.ok) {
        for (const id of currentIds) dismissedIdsRef.current.add(id);
        setItems([]);
      }
    });
  }

  function handleClick(n: NotificationRow) {
    // Mark read, close the panel, and route to the actionable
    // destination. Previously the click just marked-read and the row
    // vanished — leaving the user wondering what they were supposed to
    // do (especially for signature_needed, where the next step is sign
    // the session). Navigate even if mark-read fails so a flaky DB hit
    // doesn't trap the user.
    const dest = destinationFor(n);
    dismissedIdsRef.current.add(n.id);
    setItems((prev) => prev.filter((m) => m.id !== n.id));
    setOpen(false);
    startTransition(async () => {
      try {
        await markNotificationReadAction({ id: n.id });
      } catch (err) {
        console.error("[bell] mark-read failed:", err);
      }
    });
    if (dest) router.push(dest);
  }

  return (
    <div className="relative" ref={containerRef}>
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
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] z-50 rounded-sm border border-border bg-card shadow-lg"
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
                    onClick={() => handleClick(n)}
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
