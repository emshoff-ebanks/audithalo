"use client";

import { useState, useActionState } from "react";
import { Pencil, Check, Sparkles, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  updateTranscriptAction,
  generateNoteFromTranscriptAction,
} from "@/app/actions/transcript";

type Result = { ok: true } | { ok: false; error: string };

interface TranscriptDisplayProps {
  sessionEventId: string;
  transcript: string;
  canEdit: boolean;
  source: string | null;
}

function sourceLabel(source: string | null): string {
  switch (source) {
    case "recording":
      return "From recording";
    case "teams":
      return "From Teams";
    case "pasted":
      return "Pasted";
    case "uploaded":
      return "Uploaded";
    default:
      return source ?? "Manual";
  }
}

export function TranscriptDisplay({
  sessionEventId,
  transcript,
  canEdit,
  source,
}: TranscriptDisplayProps) {
  const [editing, setEditing] = useState(false);

  const [updateState, updateAction, updatePending] = useActionState<
    Result | undefined,
    FormData
  >(async (prev, formData) => {
    const result = await updateTranscriptAction(prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, undefined);

  const [generateState, generateAction, generatePending] = useActionState<
    Result | undefined,
    FormData
  >(generateNoteFromTranscriptAction, undefined);

  const error =
    (updateState && !updateState.ok ? updateState.error : null) ??
    (generateState && !generateState.ok ? generateState.error : null);

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-foreground/70" />
          <p className="label-overline">Transcript</p>
          <Badge variant="secondary">{sourceLabel(source)}</Badge>
        </div>

        {canEdit && !editing && (
          <div className="flex items-center gap-1">
            <form action={generateAction}>
              <input
                type="hidden"
                name="sessionEventId"
                value={sessionEventId}
              />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={generatePending}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {generatePending ? "Generating..." : "Generate AI note"}
              </Button>
            </form>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {error}
        </p>
      )}

      {/* Transcript body */}
      {editing ? (
        <form action={updateAction} className="space-y-2">
          <input
            type="hidden"
            name="sessionEventId"
            value={sessionEventId}
          />
          <textarea
            name="transcript"
            defaultValue={transcript}
            className="w-full max-h-64 min-h-[10rem] rounded-md border border-border bg-[color:var(--color-evidence-bg)] p-3 font-mono text-sm text-foreground whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={updatePending}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              {updatePending ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={updatePending}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-[color:var(--color-evidence-bg)] p-3 font-mono text-sm text-foreground whitespace-pre-wrap">
          {transcript}
        </div>
      )}
    </div>
  );
}
