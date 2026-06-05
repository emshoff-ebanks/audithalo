"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  Clock,
  TrendingUp,
  ArrowRight,
  Undo2,
} from "lucide-react";
import type { Gap, RuleSeverity } from "@/lib/rules/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  attestAction,
  undoAttestationAction,
} from "@/app/actions/attestations";

type GapRendererProps = {
  gap: Gap;
  assignmentId: string;
  superviseeId: string;
  viewerCanSupervise: boolean;
};

function severityIcon(severity: RuleSeverity) {
  if (severity === "blocker") {
    return <AlertOctagon className="h-4 w-4 shrink-0 text-[color:var(--color-risk)]" />;
  }
  if (severity === "warning") {
    return <AlertTriangle className="h-4 w-4 shrink-0 text-[color:var(--color-warning)]" />;
  }
  return <Info className="h-4 w-4 shrink-0 text-foreground/60" />;
}

function severityBg(severity: RuleSeverity) {
  if (severity === "blocker") {
    return "border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5";
  }
  if (severity === "warning") {
    return "border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/5";
  }
  return "border-border bg-[color:var(--color-evidence-bg)]/40";
}

export function GapRenderer(props: GapRendererProps) {
  const { gap } = props;
  switch (gap.action.kind) {
    case "attestation":
      return <AttestationGap {...props} />;
    case "recurring_behavior":
      return <RecurringBehaviorGap {...props} />;
    case "data_correction":
      return <DataCorrectionGap {...props} />;
    case "data_accumulation":
      return <DataAccumulationGap {...props} />;
    case "time_warning":
      return <TimeWarningGap {...props} />;
  }
}

function GapShell({
  gap,
  children,
}: {
  gap: Gap;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border rounded-sm p-3 ${severityBg(
        gap.severity
      )}`}
    >
      <div className="flex gap-3 min-w-0">
        {severityIcon(gap.severity)}
        <p className="text-sm text-foreground/80">{gap.message}</p>
      </div>
      <div className="sm:shrink-0">{children}</div>
    </div>
  );
}

function AttestationGap({
  gap,
  assignmentId,
  viewerCanSupervise,
}: GapRendererProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (gap.action.kind !== "attestation") return null;
  const action = gap.action;

  function handleSubmit(formData: FormData) {
    const date = String(formData.get("date") ?? "");
    const hoursRaw = formData.get("hours");
    const hours =
      typeof hoursRaw === "string" && hoursRaw.length > 0
        ? Number(hoursRaw)
        : undefined;
    setError(null);
    startTransition(async () => {
      const result = await attestAction({
        assignmentId,
        checkId: action.checkId,
        value: { date, hours },
      });
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.reason);
      }
    });
  }

  if (!viewerCanSupervise) {
    return (
      <GapShell gap={gap}>
        <p className="text-xs text-foreground/60 max-w-[200px]">
          Your supervisor records this attestation.
        </p>
      </GapShell>
    );
  }

  if (done) {
    return (
      <GapShell gap={gap}>
        <div className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-success)]">
          <CheckCircle2 className="h-4 w-4" />
          Attested — refreshing
        </div>
      </GapShell>
    );
  }

  return (
    <GapShell gap={gap}>
      <form action={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`date-${action.checkId}`} className="text-xs">
            Date
          </Label>
          <Input
            id={`date-${action.checkId}`}
            name="date"
            type="date"
            required
            className="h-8 w-36 text-xs"
          />
        </div>
        {action.valueShape === "date_and_hours" && (
          <div className="space-y-1">
            <Label htmlFor={`hours-${action.checkId}`} className="text-xs">
              Hours
            </Label>
            <Input
              id={`hours-${action.checkId}`}
              name="hours"
              type="number"
              min={0}
              step={1}
              required
              className="h-8 w-20 text-xs"
            />
          </div>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            action.actionLabel
          )}
        </Button>
        {error && (
          <p
            role="alert"
            className="text-xs text-[color:var(--color-risk)] w-full"
          >
            {error}
          </p>
        )}
      </form>
    </GapShell>
  );
}

function RecurringBehaviorGap({
  gap,
  superviseeId,
}: GapRendererProps) {
  if (gap.action.kind !== "recurring_behavior") return null;
  const action = gap.action;
  return (
    <GapShell gap={gap}>
      <Button asChild size="sm" variant="outline">
        <a href={`/dashboard/roster/${superviseeId}#log-session`}>
          {action.actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </Button>
    </GapShell>
  );
}

function DataCorrectionGap({
  gap,
  superviseeId,
}: GapRendererProps) {
  if (gap.action.kind !== "data_correction") return null;
  const action = gap.action;
  const idsParam = action.targetSessionIds.join(",");
  const linkHref = `/dashboard/roster/${superviseeId}#session-log${
    idsParam ? `?flagged=${encodeURIComponent(idsParam)}` : ""
  }`;
  return (
    <GapShell gap={gap}>
      <div className="flex flex-col items-stretch gap-1.5">
        <Button asChild size="sm" variant="outline">
          <Link href={linkHref}>
            {action.actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        {action.targetSessionIds.length > 0 && (
          <p className="text-[10px] text-foreground/60 font-mono">
            {action.targetSessionIds.length} flagged
          </p>
        )}
      </div>
    </GapShell>
  );
}

function DataAccumulationGap({ gap }: GapRendererProps) {
  if (gap.action.kind !== "data_accumulation") return null;
  const { logged, required, unit } = gap.action.progressTowards;
  const pct = required === 0 ? 0 : Math.min(100, (logged / required) * 100);
  return (
    <GapShell gap={gap}>
      <div className="flex flex-col gap-1 min-w-[160px]">
        <div className="flex items-center justify-between gap-2 text-xs">
          <TrendingUp className="h-3.5 w-3.5 text-foreground/60" />
          <span className="font-mono text-foreground">
            {logged.toFixed(1)} / {required} {unit}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-[color:var(--color-gold)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </GapShell>
  );
}

function TimeWarningGap({ gap }: GapRendererProps) {
  if (gap.action.kind !== "time_warning") return null;
  const { daysRemaining, isOverdue } = gap.action;
  const color = isOverdue
    ? "text-[color:var(--color-risk)]"
    : "text-[color:var(--color-warning)]";
  return (
    <GapShell gap={gap}>
      <div className={`inline-flex items-center gap-1.5 text-xs ${color}`}>
        <Clock className="h-3.5 w-3.5" />
        {isOverdue
          ? `Overdue by ${Math.abs(daysRemaining)} days`
          : `${daysRemaining} days remaining`}
      </div>
    </GapShell>
  );
}

/**
 * Supervisor-only "undo attestation" button — surfaced as a small caret next
 * to each typed-attestation field elsewhere on the page. Kept here so the
 * server action and form pattern stay co-located with the renderer.
 */
export function UndoAttestationButton({
  assignmentId,
  checkId,
  superviseeId,
}: {
  assignmentId: string;
  checkId: string;
  superviseeId: string;
}) {
  const [pending, startTransition] = useTransition();
  void superviseeId;
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await undoAttestationAction({ assignmentId, checkId });
        })
      }
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <>
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </>
      )}
    </Button>
  );
}
