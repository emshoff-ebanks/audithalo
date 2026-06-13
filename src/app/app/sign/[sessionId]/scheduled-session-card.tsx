"use client";

import { useActionState, useEffect, useState } from "react";
import { Calendar, Video, MapPin, Loader2, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cancelScheduledSessionAction,
  markSessionNoShowAction,
  type ActionResult,
} from "@/app/actions/sessions";
import { RescheduleForm } from "./reschedule-form";

type Props = {
  sessionId: string;
  scheduledForUtcIso: string;
  scheduledForLocal: string;
  durationMinutes: number;
  timeZone: string | null;
  meetingProvider: "teams" | "google_meet" | "in_person" | null;
  meetingJoinUrl: string | null;
  location: string | null;
  canCancel: boolean;
  /** Reschedule available when the row isn't part of a recurring series.
   *  Phase 3.5 will lift that restriction. */
  canReschedule: boolean;
  /** Mark-as-no-show authorization — wider than canCancel because the
   *  supervisee can also flag their own meeting as didn't-attend. */
  canMarkNoShow: boolean;
  /** Drives the cancel-confirm copy variant — when this row belongs to a
   *  recurring series we warn that the provider series isn't touched. */
  isRecurring: boolean;
};

export function ScheduledSessionCard({
  sessionId,
  scheduledForUtcIso,
  scheduledForLocal,
  durationMinutes,
  timeZone,
  meetingProvider,
  meetingJoinUrl,
  location,
  canCancel,
  canReschedule,
  canMarkNoShow,
  isRecurring,
}: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(cancelScheduledSessionAction, undefined);
  const [noShowState, noShowAction, noShowPending] = useActionState<
    ActionResult | undefined,
    FormData
  >(markSessionNoShowAction, undefined);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);

  const startMs = new Date(scheduledForUtcIso).getTime();
  // Live clock for the join-button window + "happening now" badge.
  // Server-renders with startMs so the countdown shows "starts in 0 min"
  // pre-hydration (deterministic), then upgrades to wall-clock on mount
  // and ticks every 30s.
  // Previously used useSyncExternalStore with `() => Date.now()` as the
  // snapshot fn, which infinite-looped because every render's snapshot
  // differed from the previous (React error #185).
  const [nowMs, setNowMs] = useState<number>(() => startMs);
  useEffect(() => {
    // One cascading render to upgrade from the SSR snapshot to wall
    // clock; see _calendar-view.tsx for the same pattern. The lint
    // disable is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const minutesToStart = Math.round((startMs - nowMs) / 60_000);
  const minutesToEnd = minutesToStart + durationMinutes;
  // Show Join button from 10 min before start through end of the meeting.
  const joinable = minutesToStart <= 10 && minutesToEnd > 0;
  const isHappeningNow = minutesToStart <= 0 && minutesToEnd > 0;

  const providerLabel =
    meetingProvider === "teams"
      ? "Microsoft Teams"
      : meetingProvider === "google_meet"
        ? "Google Meet"
        : meetingProvider === "in_person"
          ? "In person"
          : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant={isHappeningNow ? "outline-warn" : "outline"}>
            {isHappeningNow
              ? "Happening now"
              : minutesToStart > 0
                ? `Starts in ${formatCountdown(minutesToStart)}`
                : "Awaiting completion"}
          </Badge>
          <h2 className="font-display text-2xl font-semibold mt-3 text-foreground">
            Scheduled supervision
          </h2>
          <p className="text-sm text-foreground/70 mt-1">
            {scheduledForLocal}
            {timeZone ? ` (${timeZone})` : ""}
            <span className="mx-2 text-foreground/40">·</span>
            {durationMinutes} min
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="flex items-start gap-2 p-3 rounded-sm border border-border">
          <Calendar className="h-4 w-4 mt-0.5 text-foreground/60" />
          <div>
            <p className="label-overline">When</p>
            <p className="text-foreground">{scheduledForLocal}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-sm border border-border">
          {meetingProvider === "in_person" ? (
            <MapPin className="h-4 w-4 mt-0.5 text-foreground/60" />
          ) : (
            <Video className="h-4 w-4 mt-0.5 text-foreground/60" />
          )}
          <div>
            <p className="label-overline">Where</p>
            <p className="text-foreground">
              {providerLabel ?? "—"}
              {location && meetingProvider === "in_person" && (
                <span className="block text-xs text-foreground/60 mt-0.5">
                  {location}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {meetingJoinUrl && (
        <Button
          asChild
          className="w-full"
          variant={joinable ? "default" : "outline"}
        >
          <a href={meetingJoinUrl} target="_blank" rel="noopener noreferrer">
            <Video className="h-4 w-4" />
            {joinable ? "Join meeting" : "Open meeting link"}
          </a>
        </Button>
      )}

      {canReschedule && !showReschedule && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setShowReschedule(true)}
        >
          Reschedule
        </Button>
      )}

      {canReschedule && showReschedule && (
        <RescheduleForm
          sessionId={sessionId}
          currentStartUtcIso={scheduledForUtcIso}
          currentDurationMinutes={durationMinutes}
          currentTimeZone={timeZone}
          onCancel={() => setShowReschedule(false)}
        />
      )}

      {canCancel && !showConfirm && !showReschedule && (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="text-xs text-foreground/60 underline hover:text-foreground"
        >
          Cancel this session
        </button>
      )}

      {canCancel && showConfirm && (
        <form action={formAction} className="space-y-3 rounded-sm border border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5 p-4">
          <input type="hidden" name="sessionId" value={sessionId} />
          <p className="text-sm text-foreground">
            {isRecurring
              ? "Cancel this single occurrence? It will be removed from AuditHalo and the supervisee will be notified. Note: the recurring series on your Outlook or Google calendar isn't modified — only this one row is canceled here."
              : "Cancel this scheduled session? The calendar invite will be withdrawn and the supervisee will be notified."}
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
              className="text-sm text-[color:var(--color-risk)]"
            >
              {state.error}
            </p>
          )}
        </form>
      )}

      {/* "Didn't attend" — distinct from Cancel. Cancel = intentionally
          scrapped; no-show = scheduled time passed without anyone meeting.
          Only useful once the meeting has actually started, so we gate on
          minutesToStart <= 0. Anyone authorized to cancel can flag it. */}
      {canMarkNoShow && minutesToStart <= 0 && !showNoShowConfirm && !showConfirm && (
        <button
          type="button"
          onClick={() => setShowNoShowConfirm(true)}
          className="inline-flex items-center gap-1.5 text-xs text-foreground/60 underline hover:text-foreground"
        >
          <UserX className="h-3 w-3" />
          Didn&apos;t attend
        </button>
      )}

      {canMarkNoShow && minutesToStart <= 0 && showNoShowConfirm && (
        <form
          action={noShowAction}
          className="space-y-3 rounded-sm border border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/5 p-4"
        >
          <input type="hidden" name="sessionId" value={sessionId} />
          <p className="text-sm text-foreground">
            Flag this session as a no-show? It won&apos;t count toward
            supervision hours and the row stays in the audit log marked
            &quot;no-show&quot;. The calendar event isn&apos;t modified — only
            the AuditHalo record.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={noShowPending}
            >
              {noShowPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Yes, mark no-show
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowNoShowConfirm(false)}
              disabled={noShowPending}
            >
              Cancel
            </Button>
          </div>
          {noShowState && noShowState.ok === false && (
            <p
              role="alert"
              className="text-sm text-[color:var(--color-risk)]"
            >
              {noShowState.error}
            </p>
          )}
        </form>
      )}

      <p className="text-xs text-foreground/60 pt-4 border-t border-border">
        After the meeting ends, this page becomes the signature + AI-note
        flow. The transcript can be pasted here once the session is complete.
      </p>
    </div>
  );
}


function formatCountdown(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const m = mins % 60;
  if (hours < 24)
    return m === 0 ? `${hours}h` : `${hours}h ${m}m`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
