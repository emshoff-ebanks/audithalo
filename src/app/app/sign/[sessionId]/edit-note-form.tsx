"use client";

import { useState, useActionState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateSessionNoteAction } from "@/app/actions/ai-note";

type Result = { ok: true } | { ok: false; error: string };

type NoteContent = {
  topics: string[];
  competencies: string[];
  supervisorFeedback: string;
  nextSteps: string[];
};

export function EditNoteSlot({
  sessionEventId,
  initial,
}: {
  sessionEventId: string;
  initial: NoteContent;
}) {
  const [editing, setEditing] = useState(false);
  const [lastSeenSuccess, setLastSeenSuccess] = useState<Result | undefined>(undefined);
  const [state, formAction, pending] = useActionState<Result | undefined, FormData>(
    updateSessionNoteAction,
    undefined
  );

  // Close the editor when a save succeeds. This is the "store info from previous
  // renders" idiom — we compare the new state to the previously-seen success state
  // and call setEditing(false) during render. React handles this correctly and
  // does not infinite-loop because subsequent renders see lastSeenSuccess === state.
  // See https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (state?.ok === true && lastSeenSuccess !== state) {
    setLastSeenSuccess(state);
    if (editing) setEditing(false);
  }

  if (!editing) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-4 border-t border-border pt-4">
      <input type="hidden" name="sessionEventId" value={sessionEventId} />

      <div>
        <Label htmlFor="edit-topics">Topics covered (one per line)</Label>
        <textarea
          id="edit-topics"
          name="topics"
          defaultValue={initial.topics.join("\n")}
          rows={4}
          className="mt-2 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <Label htmlFor="edit-competencies">Competencies addressed (one per line)</Label>
        <textarea
          id="edit-competencies"
          name="competencies"
          defaultValue={initial.competencies.join("\n")}
          rows={4}
          className="mt-2 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <Label htmlFor="edit-supervisorFeedback">Supervisor feedback</Label>
        <textarea
          id="edit-supervisorFeedback"
          name="supervisorFeedback"
          defaultValue={initial.supervisorFeedback}
          rows={4}
          className="mt-2 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <Label htmlFor="edit-nextSteps">Next steps (one per line)</Label>
        <textarea
          id="edit-nextSteps"
          name="nextSteps"
          defaultValue={initial.nextSteps.join("\n")}
          rows={4}
          className="mt-2 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          <Save className="h-3.5 w-3.5" />
          {pending ? "Saving…" : "Save edits"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(false)}
          disabled={pending}
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </form>
  );
}
