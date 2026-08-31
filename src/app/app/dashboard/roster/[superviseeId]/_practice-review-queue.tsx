"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  approvePracticeHoursAction,
  rejectPracticeHoursAction,
} from "@/app/actions/practice-approval";

type PendingEntry = {
  id: string;
  date: string;
  durationHours: number;
  directContactHours: number | null;
  practiceState: string | null;
};

type Result = { ok: true; count?: number } | { ok: false; error: string };

export function PracticeReviewQueue({
  entries,
}: {
  entries: PendingEntry[];
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const [approveState, approveAction, approvePending] = useActionState<
    Result | undefined,
    FormData
  >(approvePracticeHoursAction, undefined);

  const [rejectState, rejectAction, rejectPending] = useActionState<
    Result | undefined,
    FormData
  >(rejectPracticeHoursAction, undefined);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label-overline">
          Practice hours pending review ({entries.length})
        </p>
        <form action={approveAction}>
          <input
            type="hidden"
            name="sessionEventIds"
            value={JSON.stringify(entries.map((e) => e.id))}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={approvePending}
          >
            {approvePending ? "Approving..." : "Approve all"}
          </Button>
        </form>
      </div>

      {approveState && !approveState.ok && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {approveState.error}
        </p>
      )}

      <div className="border border-border rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card">
              <th className="text-left py-2 px-3 label-overline font-medium">
                Date
              </th>
              <th className="text-left py-2 px-3 label-overline font-medium">
                Hours
              </th>
              <th className="text-left py-2 px-3 label-overline font-medium hidden sm:table-cell">
                Direct contact
              </th>
              <th className="text-left py-2 px-3 label-overline font-medium hidden sm:table-cell">
                State
              </th>
              <th className="text-right py-2 px-3 label-overline font-medium">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-2 px-3 font-mono text-foreground">
                  {entry.date}
                </td>
                <td className="py-2 px-3 font-mono text-foreground">
                  {entry.durationHours.toFixed(1)}
                </td>
                <td className="py-2 px-3 font-mono text-foreground/70 hidden sm:table-cell">
                  {entry.directContactHours?.toFixed(1) ?? "—"}
                </td>
                <td className="py-2 px-3 text-foreground/70 hidden sm:table-cell">
                  {entry.practiceState ?? "—"}
                </td>
                <td className="py-2 px-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <form action={approveAction}>
                      <input
                        type="hidden"
                        name="sessionEventIds"
                        value={JSON.stringify([entry.id])}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        disabled={approvePending}
                        className="text-[color:var(--color-success)] hover:text-[color:var(--color-success)]"
                      >
                        Approve
                      </Button>
                    </form>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[color:var(--color-risk)] hover:text-[color:var(--color-risk)]"
                      onClick={() => {
                        setRejectingId(entry.id);
                        setReason("");
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rejectingId && (
        <form
          action={rejectAction}
          className="border border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5 rounded-sm p-4 space-y-3"
        >
          <input type="hidden" name="sessionEventId" value={rejectingId} />
          <p className="text-sm font-medium text-foreground">
            Reject practice hours for{" "}
            {entries.find((e) => e.id === rejectingId)?.date ?? "this entry"}?
          </p>
          <textarea
            name="reason"
            required
            minLength={1}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (supervisee will see this)"
            rows={2}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
          />
          {rejectState && !rejectState.ok && (
            <p
              role="alert"
              className="text-sm text-[color:var(--color-risk)]"
            >
              {rejectState.error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={rejectPending || reason.trim().length === 0}
            >
              {rejectPending ? "Rejecting..." : "Confirm rejection"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRejectingId(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
