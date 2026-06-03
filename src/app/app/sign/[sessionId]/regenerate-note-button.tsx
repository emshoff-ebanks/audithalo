"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionNoteForm } from "./session-note-form";

export function RegenerateNoteSlot({ sessionEventId }: { sessionEventId: string }) {
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (isRegenerating) {
    return (
      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <p className="text-sm text-foreground/70">
          Paste a new transcript to replace the current note. The existing note will
          be overwritten on save. This counts against your monthly AI note quota.
        </p>
        <SessionNoteForm sessionEventId={sessionEventId} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsRegenerating(false)}
        >
          Cancel regeneration
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setIsRegenerating(true)}
    >
      <RotateCw className="h-3.5 w-3.5" />
      Regenerate
    </Button>
  );
}
