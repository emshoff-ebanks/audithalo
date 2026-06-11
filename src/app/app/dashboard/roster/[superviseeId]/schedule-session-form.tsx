"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  scheduleSessionAction,
  type ActionResult,
} from "@/app/actions/sessions";

function noopSubscribe(): () => void {
  return () => {};
}

function computeDefaultLocalStart(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setMinutes(t.getMinutes() < 30 ? 30 : 60, 0, 0);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

type Provider = "microsoft" | "google";

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
};

const PROVIDER_LABEL: Record<Provider, string> = {
  microsoft: "Microsoft Teams",
  google: "Google Meet",
};

export function ScheduleSessionForm({
  superviseeId,
  connectedProviders,
  onBehalfOfName,
}: Props) {
  const onBehalf = !!onBehalfOfName;
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(scheduleSessionAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  const [modality, setModality] = useState<"virtual" | "in_person">("virtual");

  // Read browser-only values via useSyncExternalStore so render stays
  // pure and we don't trip the set-state-in-effect lint. Server snapshot
  // is empty; client snapshot is the real value post-hydration.
  const tz = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => ""
  );
  const defaultLocalStart = useSyncExternalStore(
    noopSubscribe,
    computeDefaultLocalStart,
    () => ""
  );

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
      action={(fd) => formAction(buildStartUtc(fd))}
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
          <Input
            id="localStart"
            name="localStart"
            type="datetime-local"
            required
            key={defaultLocalStart || "empty"}
            defaultValue={defaultLocalStart}
            className="mt-1.5"
          />
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

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

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
        {pending ? "Scheduling…" : "Schedule session"}
      </Button>

      <p className="text-xs text-foreground/60">
        Times shown in <span className="font-mono">{tz || "your timezone"}</span>.
        Both parties receive a calendar invite.
      </p>
    </form>
  );
}
