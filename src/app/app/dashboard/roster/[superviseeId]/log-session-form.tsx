"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logSessionAction, type ActionResult } from "@/app/actions/supervisee";

export function LogSessionForm({
  superviseeId,
  allowSupervision = true,
}: {
  superviseeId: string;
  allowSupervision?: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(logSessionAction, undefined);
  const [kind, setKind] = useState<"practice" | "supervision">("practice");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="superviseeId" value={superviseeId} />
      {allowSupervision ? (
        <div>
          <Label htmlFor="kind">Session kind</Label>
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as "practice" | "supervision")
            }
            className="mt-1.5 flex h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="practice">Practice (clinical work)</option>
            <option value="supervision">Supervision (with supervisor)</option>
          </select>
        </div>
      ) : (
        <input type="hidden" name="kind" value="practice" />
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="durationHours">Hours</Label>
          <Input
            id="durationHours"
            name="durationHours"
            type="number"
            step="0.25"
            min="0.25"
            required
            defaultValue={kind === "practice" ? "8" : "1"}
            className="mt-1.5"
          />
        </div>
      </div>

      {kind === "supervision" && (
        <>
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
            <Label htmlFor="supervisorCredentials">
              Supervisor credentials (comma-separated)
            </Label>
            <Input
              id="supervisorCredentials"
              name="supervisorCredentials"
              type="text"
              placeholder="LCMHCS, LCSW"
              defaultValue="LCMHCS"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="groupAttendees">Group attendees (if group)</Label>
            <Input
              id="groupAttendees"
              name="groupAttendees"
              type="number"
              min="2"
              placeholder="e.g. 4"
              className="mt-1.5"
            />
          </div>
        </>
      )}

      {state && state.ok === false && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Logging…" : "Log session"}
      </Button>
    </form>
  );
}
