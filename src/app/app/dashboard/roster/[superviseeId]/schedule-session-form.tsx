"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTime12h } from "@/components/ui/datetime-12h";
import { useSearchParams } from "next/navigation";
import {
  scheduleRecurringSeriesAction,
  scheduleSessionAction,
  type ActionResult,
} from "@/app/actions/sessions";

/** Convert a UTC ISO instant to the browser-local datetime-local string. */
function toLocalDatetimeString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function computeDefaultLocalStart(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setMinutes(t.getMinutes() < 30 ? 30 : 60, 0, 0);
  return toLocalDatetimeString(t);
}

type Provider = "microsoft" | "google";

type Conflict = { title: string; startUtcIso: string; endUtcIso: string };

type ConnectedProvider = {
  name: Provider;
  accountEmail: string | null;
  isPreferred: boolean;
};

type Props = {
  superviseeId: string;
  connectedProviders: ConnectedProvider[];
  /** When set (HR Admin scheduling on behalf), copy adapts to point at
   *  the hosting supervisor's account rather than the actor's. */
  onBehalfOfName: string | null;
  /** Other supervisees in the org the actor can add to a group session.
   *  Excludes the primary. */
  groupCandidates: { id: string; name: string }[];
};

const PROVIDER_LABEL: Record<Provider, string> = {
  microsoft: "Microsoft Teams",
  google: "Google Meet",
};

export function ScheduleSessionForm({
  superviseeId,
  connectedProviders,
  onBehalfOfName,
  groupCandidates,
}: Props) {
  const [additionalAttendeeIds, setAdditionalAttendeeIds] = useState<
    Set<string>
  >(new Set());
  const onBehalf = !!onBehalfOfName;
  const [recurring, setRecurring] = useState(false);
  // Two action states swapped based on the recurring toggle. useActionState
  // bindings have to be stable per-render, so we keep both alive and pick
  // which one to dispatch in the form's action handler.
  const [oneOffState, oneOffAction, oneOffPending] = useActionState<
    ActionResult | undefined,
    FormData
  >(scheduleSessionAction, undefined);
  const [recurringState, recurringAction, recurringPending] = useActionState<
    ActionResult | undefined,
    FormData
  >(scheduleRecurringSeriesAction, undefined);
  const state = recurring ? recurringState : oneOffState;
  const pending = recurring ? recurringPending : oneOffPending;
  const formRef = useRef<HTMLFormElement>(null);
  const [frequency, setFrequency] = useState<
    "weekly" | "biweekly" | "every_3_weeks" | "monthly"
  >("weekly");
  const [occurrenceCount, setOccurrenceCount] = useState(8);

  const [modality, setModality] = useState<"virtual" | "in_person">("virtual");

  // Browser-only values picked up after hydration. Initialize empty on
  // SSR (deterministic) and overwrite once mounted — using useState +
  // useEffect instead of useSyncExternalStore avoids the
  // snapshot-returns-a-new-value-per-render trap that infinite-loops
  // React (error #185).
  const searchParams = useSearchParams();
  const startFromUrl = searchParams?.get("start") ?? null;
  const [tz, setTz] = useState<string>("");
  const [defaultLocalStart, setDefaultLocalStart] = useState<string>("");
  useEffect(() => {
    // Cascading mount-time updates to swap empty SSR placeholders for
    // browser-only values. Lint disable is intentional; see
    // _calendar-view.tsx for the same SSR-safe pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (startFromUrl) {
      const d = new Date(startFromUrl);
      if (!Number.isNaN(d.getTime())) {
        setDefaultLocalStart(toLocalDatetimeString(d));
        return;
      }
    }
    setDefaultLocalStart(computeDefaultLocalStart());
  }, [startFromUrl]);

  // Seed the provider picker with the user's preferred (or only) connected
  // provider. Derived from props, so safe to compute during render.
  const initialProvider: Provider | "" =
    connectedProviders.find((p) => p.isPreferred)?.name ??
    (connectedProviders.length === 1 ? connectedProviders[0].name : "");
  const [selectedProvider, setSelectedProvider] = useState<Provider | "">(
    initialProvider
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  function buildStartUtc(formData: FormData): FormData {
    // Convert the datetime-local string to a UTC ISO instant before submit.
    const local = formData.get("localStart") as string;
    if (local) {
      const isoUtc = new Date(local).toISOString();
      formData.set("startUtc", isoUtc);
    }
    formData.delete("localStart");
    return formData;
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        const built = buildStartUtc(fd);
        if (additionalAttendeeIds.size > 0) {
          built.set(
            "additionalAttendeeIds",
            [...additionalAttendeeIds].join(",")
          );
        }
        if (recurring) {
          built.set("frequency", frequency);
          built.set("occurrenceCount", String(occurrenceCount));
          recurringAction(built);
        } else {
          oneOffAction(built);
        }
      }}
      className="space-y-3"
    >
      <input type="hidden" name="superviseeId" value={superviseeId} />
      <input type="hidden" name="timeZone" value={tz} />

      <div>
        <Label>Modality</Label>
        <div className="mt-1.5 flex gap-2">
          {(["virtual", "in_person"] as const).map((m) => (
            <label
              key={m}
              className={`flex-1 flex items-center gap-2 rounded-sm border px-3 py-2 text-sm cursor-pointer transition-colors ${
                modality === m
                  ? "border-foreground bg-accent/40"
                  : "border-border hover:bg-accent/40"
              }`}
            >
              <input
                type="radio"
                name="modality"
                value={m}
                checked={modality === m}
                onChange={() => setModality(m)}
                className="accent-foreground"
              />
              {m === "virtual" ? "Virtual" : "In person"}
            </label>
          ))}
        </div>
      </div>

      {modality === "virtual" && (
        <div>
          <Label htmlFor="provider">Calendar / meeting provider</Label>
          {connectedProviders.length === 0 ? (
            onBehalf ? (
              <p className="mt-1.5 text-sm text-foreground/70">
                <span className="font-medium text-foreground">
                  {onBehalfOfName}
                </span>{" "}
                hasn&apos;t connected a calendar yet. Ask them to connect
                Microsoft or Google from{" "}
                <span className="font-mono text-xs">
                  Account → Integrations
                </span>{" "}
                before you can schedule a virtual session on their behalf.
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-foreground/70">
                No calendar connected.{" "}
                <a
                  href="/dashboard/account#integrations"
                  className="underline hover:no-underline"
                >
                  Connect Microsoft or Google
                </a>{" "}
                to schedule virtual sessions.
              </p>
            )
          ) : connectedProviders.length === 1 ? (
            <p className="mt-1.5 text-sm text-foreground/70">
              Using{" "}
              <span className="font-medium text-foreground">
                {PROVIDER_LABEL[connectedProviders[0].name]}
              </span>{" "}
              ({connectedProviders[0].accountEmail ?? "connected account"})
            </p>
          ) : (
            <select
              id="provider"
              name="provider"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as Provider)}
              className="mt-1.5 flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
            >
              {connectedProviders.map((p) => (
                <option key={p.name} value={p.name}>
                  {PROVIDER_LABEL[p.name]}
                  {p.isPreferred ? " (preferred)" : ""}
                  {p.accountEmail ? ` — ${p.accountEmail}` : ""}
                </option>
              ))}
            </select>
          )}
          {connectedProviders.length === 1 && (
            <input
              type="hidden"
              name="provider"
              value={connectedProviders[0].name}
            />
          )}
        </div>
      )}

      {modality === "in_person" && (
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            type="text"
            placeholder="123 Main St, Suite 200"
            className="mt-1.5"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="localStart">Start</Label>
          <div className="mt-1.5">
            <DateTime12h
              id="localStart"
              name="localStart"
              key={defaultLocalStart || "empty"}
              defaultValue={defaultLocalStart}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            step="15"
            min="15"
            max="480"
            required
            defaultValue={60}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="rounded-sm border border-border p-3 space-y-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="mt-0.5 accent-foreground"
          />
          <span>
            <span className="text-sm font-medium text-foreground">
              Repeat this session
            </span>
            <span className="block text-xs text-foreground/60 mt-0.5">
              Creates a recurring series on the calendar with one
              meeting link that covers every occurrence.
            </span>
          </span>
        </label>
        {recurring && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <Label htmlFor="frequency">Frequency</Label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as typeof frequency)
                }
                className="mt-1.5 flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="every_3_weeks">Every 3 weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <Label htmlFor="occurrenceCount">Number of sessions</Label>
              <Input
                id="occurrenceCount"
                type="number"
                min={2}
                max={52}
                value={occurrenceCount}
                onChange={(e) =>
                  setOccurrenceCount(
                    Math.max(2, Math.min(52, Number(e.target.value) || 2))
                  )
                }
                className="mt-1.5"
              />
              <p className="text-xs text-foreground/60 mt-1">
                Capped at 52 (about a year of weekly).
              </p>
            </div>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="sessionType">Supervision type</Label>
        <select
          id="sessionType"
          name="sessionType"
          defaultValue="individual"
          className="mt-1.5 flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="individual">Individual</option>
          <option value="triadic">Triadic</option>
          <option value="group">Group</option>
        </select>
      </div>

      {groupCandidates.length > 0 && (
        <div>
          <Label>Additional supervisees (group session)</Label>
          <div className="mt-1.5 max-h-32 overflow-y-auto rounded-sm border border-border bg-card p-2 space-y-1">
            {groupCandidates.map((s) => {
              const checked = additionalAttendeeIds.has(s.id);
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-1 py-0.5 rounded-sm cursor-pointer hover:bg-accent/40 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setAdditionalAttendeeIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id);
                        else next.add(s.id);
                        return next;
                      })
                    }
                    className="accent-foreground"
                  />
                  <span className="text-foreground">{s.name}</span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-foreground/60 mt-1">
            {additionalAttendeeIds.size === 0
              ? "Leave blank for a 1:1 session. ALL added supervisees will need to sign before the session seals."
              : `${additionalAttendeeIds.size} additional ${additionalAttendeeIds.size === 1 ? "supervisee" : "supervisees"} added.`}
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="notes">Notes (shown in the calendar invite)</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          className="mt-1.5 flex w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
        />
      </div>

      {(() => {
        if (!state || state.ok !== false) return null;
        const conflicts: Conflict[] =
          "conflicts" in state && Array.isArray(state.conflicts)
            ? (state.conflicts as Conflict[])
            : [];
        return (
          <div
            role="alert"
            className="text-sm bg-[color:var(--color-warning)]/10 border border-[color:var(--color-warning)]/30 px-3 py-2 rounded-sm space-y-2"
          >
            <p className="text-foreground/90">{state.error}</p>
            {conflicts.length > 0 && (
              <ul className="text-xs text-foreground/70 space-y-1">
                {conflicts.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-[10px]">
                      {new Date(c.startUtcIso).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="truncate">{c.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      <input
        type="hidden"
        name="confirmConflicts"
        value={
          state && state.ok === false && "conflicts" in state
            ? "true"
            : "false"
        }
      />

      {/* Prominent blocker callout directly above the submit button — the
          smaller "why disabled" hint stayed below the button too long
          without anyone noticing. */}
      {(() => {
        if (pending) return null;
        if (modality === "virtual" && connectedProviders.length === 0) {
          return (
            <div className="rounded-sm border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 px-3 py-2.5 text-sm text-foreground">
              <p className="font-medium mb-0.5">Calendar not connected</p>
              <p className="text-xs text-foreground/80">
                {onBehalf ? (
                  <>
                    Schedule is blocked because{" "}
                    <span className="font-medium">{onBehalfOfName}</span>{" "}
                    hasn&apos;t connected Microsoft or Google yet. Ask them to
                    open <span className="font-mono text-[11px]">Account → Integrations</span>{" "}
                    and connect a calendar — then refresh this page.
                  </>
                ) : (
                  <>
                    Schedule is blocked because you haven&apos;t connected
                    Microsoft or Google yet.{" "}
                    <a
                      href="/dashboard/account#integrations"
                      className="underline hover:no-underline font-medium"
                    >
                      Connect a calendar
                    </a>
                    , or switch this session to <strong>In person</strong>{" "}
                    above and continue.
                  </>
                )}
              </p>
            </div>
          );
        }
        if (!tz) {
          return (
            <p className="rounded-sm border border-border bg-card px-3 py-2 text-xs text-foreground/70">
              Waiting for your browser to report its timezone. Refresh the page
              if this persists.
            </p>
          );
        }
        return null;
      })()}

      <Button
        type="submit"
        className="w-full"
        disabled={
          pending ||
          !tz ||
          (modality === "virtual" && connectedProviders.length === 0)
        }
      >
        {pending && <Loader2 className="h-3 w-3 animate-spin" />}
        {pending
          ? "Scheduling…"
          : (() => {
              const hasConflicts =
                state &&
                state.ok === false &&
                "conflicts" in state &&
                Array.isArray((state as { conflicts?: unknown }).conflicts) &&
                ((state as { conflicts: unknown[] }).conflicts.length ?? 0) > 0;
              if (hasConflicts) return "Schedule anyway";
              return recurring
                ? `Schedule ${occurrenceCount} sessions`
                : "Schedule session";
            })()}
      </Button>

      <p className="text-xs text-foreground/60">
        Times shown in <span className="font-mono">{tz || "your timezone"}</span>.
        Both parties receive a calendar invite.
      </p>
    </form>
  );
}
