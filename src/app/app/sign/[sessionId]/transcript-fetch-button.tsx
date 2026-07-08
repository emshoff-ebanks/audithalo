"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchTranscriptAndGenerateNoteAction } from "@/app/actions/ai-note";
import { SessionNoteForm } from "./session-note-form";

const PROVIDER_LABELS: Record<string, string> = {
  teams: "Microsoft Teams",
  google_meet: "Google Meet",
};

export function TranscriptFetchButton({
  sessionEventId,
  meetingProvider,
}: {
  sessionEventId: string;
  meetingProvider: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);

  const providerLabel = PROVIDER_LABELS[meetingProvider] ?? meetingProvider;

  function handleFetchTranscript() {
    setError(null);
    startTransition(async () => {
      const result = await fetchTranscriptAndGenerateNoteAction(sessionEventId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/70">
        This session was held via {providerLabel}. You can generate a session note
        directly from the meeting transcript.
      </p>

      <Button
        onClick={handleFetchTranscript}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isPending ? "Fetching transcript and generating note..." : "Generate note from meeting transcript"}
      </Button>

      {error && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {error}
        </p>
      )}

      {!showManualFallback ? (
        <button
          type="button"
          onClick={() => setShowManualFallback(true)}
          className="flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground/70 transition-colors"
        >
          <ChevronDown className="h-3 w-3" />
          Or paste a transcript manually
        </button>
      ) : (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-foreground/50 mb-3">
            Paste a transcript manually instead of fetching from {providerLabel}.
          </p>
          <SessionNoteForm sessionEventId={sessionEventId} />
        </div>
      )}
    </div>
  );
}
