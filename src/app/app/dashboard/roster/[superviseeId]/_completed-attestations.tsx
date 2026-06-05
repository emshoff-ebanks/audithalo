"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Pencil,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  attestAction,
  undoAttestationAction,
} from "@/app/actions/attestations";

/**
 * One serializable row that the server-side parent computes for every check
 * the supervisor has attested for this assignment. Built from the typed
 * columns on supervisee_rule_assignments (supervisionContractFiledAt,
 * supervisorTrainingCompletedAt, permitExpiresAt) plus the jsonb attestations
 * bag for any future-extensible checks.
 */
export type CompletedAttestation = {
  checkId: string;
  label: string;
  description?: string;
  date: string; // ISO yyyy-mm-dd
  hours?: number; // present when valueShape === "date_and_hours"
  permitIssuedAt?: string; // present only for permit_expiration_window
};

type Props = {
  assignmentId: string;
  superviseeId: string;
  items: CompletedAttestation[];
  viewerCanSupervise: boolean;
};

/**
 * Always-on read-out of every compliance task the supervisor has marked
 * complete for this assignment. The original Phase 5.2 attestation flow had
 * no record-of-what-was-filed surface — once attested, the gap disappeared
 * with no way to review, edit, or revoke.
 */
export function CompletedAttestations({
  assignmentId,
  superviseeId,
  items,
  viewerCanSupervise,
}: Props) {
  void superviseeId;

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="label-overline mb-3">Completed compliance tasks</p>
          <p className="text-sm text-foreground/60">
            Nothing recorded yet. Attestations a supervisor confirms on this
            page (e.g. &quot;supervision contract filed&quot;) will appear here
            so they can be reviewed or corrected later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <p className="label-overline mb-4">
          Completed compliance tasks ({items.length})
        </p>
        <ul className="space-y-3">
          {items.map((item) => (
            <CompletedRow
              key={item.checkId}
              item={item}
              assignmentId={assignmentId}
              viewerCanSupervise={viewerCanSupervise}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CompletedRow({
  item,
  assignmentId,
  viewerCanSupervise,
}: {
  item: CompletedAttestation;
  assignmentId: string;
  viewerCanSupervise: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [error, setError] = useState<string | null>(null);

  function handleEditSubmit(formData: FormData) {
    const date = String(formData.get("date") ?? "");
    const hoursRaw = formData.get("hours");
    const permitIssuedRaw = formData.get("permitIssuedAt");
    const hours =
      typeof hoursRaw === "string" && hoursRaw.length > 0
        ? Number(hoursRaw)
        : undefined;
    const permitIssuedAt =
      typeof permitIssuedRaw === "string" && permitIssuedRaw.length > 0
        ? permitIssuedRaw
        : undefined;
    setError(null);
    startTransition(async () => {
      const result = await attestAction({
        assignmentId,
        checkId: item.checkId,
        value: { date, hours, permitIssuedAt },
      });
      if (result.ok) {
        setMode("view");
      } else {
        setError(result.reason);
      }
    });
  }

  function handleRevoke() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Remove the "${item.label}" attestation? The original gap will reappear until you re-record it.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await undoAttestationAction({
        assignmentId,
        checkId: item.checkId,
      });
      if (!result.ok) setError(result.reason);
    });
  }

  return (
    <li className="rounded-sm border border-border bg-[color:var(--color-evidence-bg)]/40 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-success)]" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{item.label}</p>
            {item.description && (
              <p className="mt-0.5 text-xs text-foreground/60">
                {item.description}
              </p>
            )}
            {mode === "view" && (
              <p className="mt-1.5 text-xs font-mono text-foreground/70">
                {item.permitIssuedAt && `issued ${item.permitIssuedAt} · `}
                {item.date}
                {item.hours !== undefined && ` · ${item.hours} hours`}
              </p>
            )}
          </div>
        </div>
        {viewerCanSupervise && mode === "view" && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setError(null);
                setMode("edit");
              }}
              disabled={pending}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleRevoke}
              disabled={pending}
              className="text-[color:var(--color-risk)]"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {mode === "edit" && viewerCanSupervise && (
        <form
          action={handleEditSubmit}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          {item.permitIssuedAt !== undefined && (
            <div className="space-y-1">
              <Label
                htmlFor={`permit-issued-${item.checkId}`}
                className="text-xs"
              >
                Issued
              </Label>
              <Input
                id={`permit-issued-${item.checkId}`}
                name="permitIssuedAt"
                type="date"
                defaultValue={item.permitIssuedAt}
                className="h-8 w-36 text-xs"
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor={`date-${item.checkId}`} className="text-xs">
              {item.permitIssuedAt !== undefined ? "Expires" : "Date"}
            </Label>
            <Input
              id={`date-${item.checkId}`}
              name="date"
              type="date"
              defaultValue={item.date}
              required
              className="h-8 w-36 text-xs"
            />
          </div>
          {item.hours !== undefined && (
            <div className="space-y-1">
              <Label htmlFor={`hours-${item.checkId}`} className="text-xs">
                Hours
              </Label>
              <Input
                id={`hours-${item.checkId}`}
                name="hours"
                type="number"
                min={0}
                step={1}
                defaultValue={item.hours}
                required
                className="h-8 w-20 text-xs"
              />
            </div>
          )}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Update"
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setError(null);
              setMode("view");
            }}
            disabled={pending}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 text-xs text-[color:var(--color-risk)]"
        >
          {error}
        </p>
      )}
    </li>
  );
}
