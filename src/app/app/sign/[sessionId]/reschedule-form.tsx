"use client";

import {
  useActionState,
  useState,
  useSyncExternalStore,
} from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  rescheduleSessionAction,
  type ActionResult,
} from "@/app/actions/sessions";

function noopSubscribe(): () => void {
  return () => {};
}

type Props = {
  sessionId: string;
  /** Current scheduled UTC ISO. Used to seed the picker. */
  currentStartUtcIso: string;
  currentDurationMinutes: number;
  /** Surface in the helper text so the user knows what tz they're in. */
  currentTimeZone: string | null;
  onCancel: () => void;
};

/**
 * Compact reschedule form. Lives inside the side drawer and the
 * pre-meeting card on /sign/[sessionId]. Submits via
 * rescheduleSessionAction; the calling page handles revalidation via
 * the action's revalidatePath calls.
 */
export function RescheduleForm({
  sessionId,
  currentStartUtcIso,
  currentDurationMinutes,
  currentTimeZone,
  onCancel,
}: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(rescheduleSessionAction, undefined);

  // Default to the supervisor's CURRENT scheduled time so they only
  // tweak what they're moving. The localStart input expects naive
  // local; convert the stored UTC instant to the browser's local clock.
  const [localStart, setLocalStart] = useState<string>(() =>
    toLocalDatetimeString(new Date(currentStartUtcIso))
  );
  const [duration, setDuration] = useState(currentDurationMinutes);

  const tz = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => ""
  );

  return (
    <form
      action={(fd) => {
        const local = fd.get("localStart") as string;
        const isoUtc = new Date(local).toISOString();
        fd.set("newStartUtc", isoUtc);
        fd.set("newDurationMinutes", String(duration));
        fd.delete("localStart");
        formAction(fd);
      }}
      className="space-y-3 rounded-sm border border-secondary/30 bg-secondary/5 p-3"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="timeZone" value={tz} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="reschedule-start">New start</Label>
          <Input
            id="reschedule-start"
            name="localStart"
            type="datetime-local"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="reschedule-duration">Duration (min)</Label>
          <Input
            id="reschedule-duration"
            type="number"
            step={15}
            min={15}
            max={480}
            value={duration}
            onChange={(e) =>
              setDuration(
                Math.max(15, Math.min(480, Number(e.target.value) || 60))
              )
            }
            required
            className="mt-1.5"
          />
        </div>
      </div>

      <p className="text-xs text-foreground/60">
        Times shown in <span className="font-mono">{tz}</span>.
        {currentTimeZone && currentTimeZone !== tz && (
          <>
            {" "}
            Original was set in{" "}
            <span className="font-mono">{currentTimeZone}</span>.
          </>
        )}{" "}
        The supervisee will be notified of the new time.
      </p>

      {state && state.ok === false && (
        <p role="alert" className="text-xs text-[color:var(--color-risk)]">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          {pending ? "Saving…" : "Move session"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          Keep current time
        </Button>
      </div>
    </form>
  );
}

function toLocalDatetimeString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}
