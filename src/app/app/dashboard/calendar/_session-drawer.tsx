"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  Video,
  MapPin,
  Calendar as CalIcon,
  User,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelScheduledSessionAction,
  type ActionResult,
} from "@/app/actions/sessions";
import { EventStatusBadge } from "./_status-badge";
import { visualStatusFor, type CalendarEvent } from "./_types";

type Props = {
  event: CalendarEvent | null;
  onClose: () => void;
  viewerIsHrAdmin: boolean;
  now: number;
};

export function SessionDrawer({ event, onClose, viewerIsHrAdmin, now }: Props) {
  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!event) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [event]);

  if (!event) return null;
  return <DrawerBody event={event} onClose={onClose} viewerIsHrAdmin={viewerIsHrAdmin} now={now} />;
}

function DrawerBody({
  event,
  onClose,
  viewerIsHrAdmin,
  now,
}: {
  event: CalendarEvent;
  onClose: () => void;
  viewerIsHrAdmin: boolean;
  now: number;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(cancelScheduledSessionAction, undefined);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (state?.ok) onClose();
    // intentionally only fires when action result flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const status = visualStatusFor(event, now);
  const startDate = new Date(event.startIso);
  const endDate = new Date(event.endIso);
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  // Guard: if the row's date was malformed somewhere upstream, render a
  // simple "session not viewable" panel instead of throwing during
  // Intl.format and tripping the error boundary.
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return (
      <div
        className="fixed inset-0 z-40 flex justify-end"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          aria-label="Close session details"
          className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
          onClick={onClose}
        />
        <aside className="relative w-full max-w-sm h-full bg-card border-l border-border shadow-xl p-4">
          <p className="text-sm text-foreground/70">
            This session&apos;s time data couldn&apos;t be read. Open the session
            page from the roster to see details.
          </p>
        </aside>
      </div>
    );
  }
  const joinable =
    !!event.meetingJoinUrl &&
    now >= startMs - 10 * 60_000 &&
    now < endMs;
  const cancellable = event.scheduledStatus === "scheduled" && endMs > now;

  const tzNote = event.timeZone ? ` (${event.timeZone})` : "";
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(startDate);
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const providerLabel =
    event.meetingProvider === "teams"
      ? "Microsoft Teams"
      : event.meetingProvider === "google_meet"
        ? "Google Meet"
        : event.meetingProvider === "in_person"
          ? "In person"
          : null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close session details"
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative w-full max-w-sm h-full bg-card border-l border-border shadow-xl overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <p className="label-overline">Session details</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-foreground/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-5 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {event.superviseeName}
              </h2>
              <p className="text-xs text-foreground/60 capitalize mt-0.5">
                {event.sessionType ?? "supervision"} session
              </p>
            </div>
            <EventStatusBadge event={event} now={now} />
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm">
            <Row icon={<CalIcon className="h-4 w-4" />}>
              <p className="font-medium text-foreground">{dateFmt}</p>
              <p className="text-xs text-foreground/60">
                {timeFmt.format(startDate)} – {timeFmt.format(endDate)}
                {tzNote}
                <span className="mx-1.5">·</span>
                {event.durationMinutes} min
              </p>
            </Row>
            <Row
              icon={
                event.meetingProvider === "in_person" ? (
                  <MapPin className="h-4 w-4" />
                ) : (
                  <Video className="h-4 w-4" />
                )
              }
            >
              <p className="text-foreground">{providerLabel ?? "—"}</p>
            </Row>
            {viewerIsHrAdmin && event.supervisorName && (
              <Row icon={<User className="h-4 w-4" />}>
                <p className="text-foreground">{event.supervisorName}</p>
                <p className="text-xs text-foreground/60">Supervisor</p>
              </Row>
            )}
          </div>

          <div className="space-y-2">
            {event.meetingJoinUrl && (
              <Button
                asChild
                className="w-full"
                variant={joinable ? "default" : "outline"}
              >
                <a
                  href={event.meetingJoinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Video className="h-4 w-4" />
                  {joinable ? "Join meeting" : "Open meeting link"}
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href={`/sign/${event.id}`}>
                Open session page
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {cancellable && !showConfirm && (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="text-xs text-foreground/60 underline hover:text-foreground"
            >
              Cancel this session
            </button>
          )}
          {cancellable && showConfirm && (
            <form
              action={formAction}
              className="space-y-3 rounded-sm border border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5 p-3"
            >
              <input type="hidden" name="sessionId" value={event.id} />
              <p className="text-sm text-foreground">
                Cancel this scheduled session? The calendar invite will be
                withdrawn and the supervisee will be notified.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                >
                  {pending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Yes, cancel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirm(false)}
                  disabled={pending}
                >
                  Keep it scheduled
                </Button>
              </div>
              {state && state.ok === false && (
                <p
                  role="alert"
                  className="text-xs text-[color:var(--color-risk)]"
                >
                  {state.error}
                </p>
              )}
            </form>
          )}
          {status === "canceled" && (
            <p className="text-xs text-foreground/60 italic">
              This session was canceled. Kept on the calendar for audit only.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-sm border border-border bg-background/50 p-3">
      <div className="text-foreground/60 mt-0.5">{icon}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
