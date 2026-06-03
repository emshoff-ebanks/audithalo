"use client";

import { useActionState, useState, useMemo } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generateSessionNoteAction } from "@/app/actions/ai-note";
import { scanForPhi, phiKindLabel, type PhiMatch } from "@/lib/ai/phi-scan";

type Result = { ok: true } | { ok: false; error: string };

export function SessionNoteForm({ sessionEventId }: { sessionEventId: string }) {
  const [transcript, setTranscript] = useState("");
  const [phiConfirmed, setPhiConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState<Result | undefined, FormData>(
    generateSessionNoteAction,
    undefined
  );

  const phiMatches = useMemo<PhiMatch[]>(() => scanForPhi(transcript), [transcript]);
  const wordCount = useMemo(() => transcript.trim().split(/\s+/).filter(Boolean).length, [transcript]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="sessionEventId" value={sessionEventId} />

      <div>
        <Label htmlFor="transcript">Supervision transcript</Label>
        <p className="mt-1 text-xs text-foreground/60">
          Paste the transcript from your supervision session. The transcript is sent
          to OpenAI to generate a structured session note — it is NOT stored in AuditHalo.
        </p>
        <textarea
          id="transcript"
          name="transcript"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={10}
          required
          minLength={50}
          placeholder="Paste your supervision transcript here…"
          className="mt-2 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm font-mono text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1.5 text-xs text-foreground/50 font-mono">
          {wordCount} words
        </p>
      </div>

      {phiMatches.length > 0 && (
        <div className="p-3 rounded-sm border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-warning)]" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {phiMatches.length} possible PHI {phiMatches.length === 1 ? "match" : "matches"} found
              </p>
              <p className="mt-1 text-foreground/70 text-xs">
                The transcript appears to contain client-identifying information. Per
                AuditHalo's terms, you must remove all PHI before generating a note.
              </p>
              <ul className="mt-2 space-y-1 text-xs font-mono text-foreground/80">
                {phiMatches.slice(0, 8).map((m, i) => (
                  <li key={i}>
                    • Possible {phiKindLabel(m.kind)}:{" "}
                    <span className="bg-[color:var(--color-warning)]/15 px-1">{m.match}</span>
                  </li>
                ))}
                {phiMatches.length > 8 && (
                  <li className="text-foreground/50">+ {phiMatches.length - 8} more…</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <label className="flex gap-3 items-start cursor-pointer text-sm">
        <input
          type="checkbox"
          name="noPhiConfirmed"
          checked={phiConfirmed}
          onChange={(e) => setPhiConfirmed(e.target.checked)}
          required
          className="mt-0.5 h-4 w-4 accent-[color:var(--color-gold)]"
        />
        <span className="text-foreground/80">
          I have removed all protected health information (PHI) — client names, locations,
          phone numbers, addresses, identifiers — from this transcript. I confirm the
          content I am submitting contains no PHI.
        </span>
      </label>

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
        disabled={pending || !phiConfirmed || transcript.trim().length < 50}
      >
        <Sparkles className="h-4 w-4" />
        {pending ? "Generating note…" : "Generate session note"}
      </Button>
    </form>
  );
}
