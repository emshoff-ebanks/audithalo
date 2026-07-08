import { CheckCircle2, BookOpen, MessageSquare, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RegenerateNoteSlot } from "./regenerate-note-button";
import { EditNoteSlot } from "./edit-note-form";

type AiNote = {
  topics: string[];
  competencies: string[];
  supervisorFeedback: string;
  nextSteps: string[];
  generatedAt: string;
  generatedByUserId: string;
  model: string;
  transcriptHash: string;
  transcriptWordCount: number;
  editedAt?: string;
  editedByUserId?: string;
};

const SOURCE_LABELS: Record<string, string> = {
  teams: "From Teams transcript",
  google_meet: "From Google Meet transcript",
};

export function SessionNoteDisplay({
  note,
  sessionEventId,
  canEdit = false,
  source,
  meetingProvider,
}: {
  note: AiNote;
  sessionEventId: string;
  canEdit?: boolean;
  source?: string | null;
  meetingProvider?: string | null;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="label-overline">AI session note</p>
            {source && SOURCE_LABELS[source] && (
              <Badge variant="outline" className="text-[10px] font-normal">
                {SOURCE_LABELS[source]}
              </Badge>
            )}
          </div>
          <p className="text-xs text-foreground/50 font-mono">
            {note.transcriptWordCount} words · {note.model} · {note.generatedAt.slice(0, 10)}
            {note.editedAt && (
              <> · edited {note.editedAt.slice(0, 10)}</>
            )}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <EditNoteSlot
              sessionEventId={sessionEventId}
              initial={{
                topics: note.topics,
                competencies: note.competencies,
                supervisorFeedback: note.supervisorFeedback,
                nextSteps: note.nextSteps,
              }}
            />
            <RegenerateNoteSlot sessionEventId={sessionEventId} />
          </div>
        )}
      </div>

      {note.topics.length > 0 && (
        <Section icon={BookOpen} title="Topics covered">
          <ul className="space-y-1 text-sm text-foreground/80">
            {note.topics.map((t, i) => (
              <li key={i} className="flex gap-2"><span className="text-foreground/40">•</span>{t}</li>
            ))}
          </ul>
        </Section>
      )}

      {note.competencies.length > 0 && (
        <Section icon={CheckCircle2} title="Competencies addressed">
          <ul className="space-y-1 text-sm text-foreground/80">
            {note.competencies.map((c, i) => (
              <li key={i} className="flex gap-2"><span className="text-foreground/40">•</span>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      {note.supervisorFeedback && (
        <Section icon={MessageSquare} title="Supervisor feedback">
          <p className="text-sm text-foreground/80 leading-relaxed">
            {note.supervisorFeedback}
          </p>
        </Section>
      )}

      {note.nextSteps.length > 0 && (
        <Section icon={ListChecks} title="Next steps">
          <ul className="space-y-1 text-sm text-foreground/80">
            {note.nextSteps.map((s, i) => (
              <li key={i} className="flex gap-2"><span className="text-foreground/40">•</span>{s}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-secondary" strokeWidth={1.75} />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}
