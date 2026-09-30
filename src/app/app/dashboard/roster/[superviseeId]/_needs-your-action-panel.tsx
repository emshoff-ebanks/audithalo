import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, FileSignature } from "lucide-react";
import { PracticeReviewQueue } from "./_practice-review-queue";
import type { PendingSignatureRow } from "@/lib/supervisor-signatures";

type PendingPractice = {
  id: string;
  date: string;
  durationHours: number;
  directContactHours: number | null;
  practiceState: string | null;
};

type Props = {
  /** Signatures the viewer owes on THIS supervisee (already filtered). */
  pendingSignatures: PendingSignatureRow[];
  /** Practice events awaiting the viewer's approval on this supervisee. */
  pendingPractice: PendingPractice[];
};

/**
 * Combined "Needs your action" surface for a supervisor viewing a specific
 * supervisee — the page-level urgent panel replacing SessionLog's Zone-1
 * "Needs your attention" callout (which is now suppressed via
 * hideAttentionZone inside the session-log modal, so the same list never
 * shows twice on one screen).
 *
 * Renders nothing when both lists are empty — the absence is the signal.
 */
export function NeedsYourActionPanel({
  pendingSignatures,
  pendingPractice,
}: Props) {
  if (pendingSignatures.length === 0 && pendingPractice.length === 0) {
    return null;
  }

  return (
    <div className="panel panel-flush overflow-hidden">
      <div className="px-5 py-4 border-b border-[color:var(--border)]">
        <p className="label-overline">Needs your action</p>
      </div>

      {pendingSignatures.length > 0 && (
        <div className="border-b border-[color:var(--divider)]">
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-medium text-[color:var(--text-secondary)]">
              Sessions to sign ({pendingSignatures.length})
            </p>
          </div>
          <ul className="row-zebra">
            {pendingSignatures.map((row) => (
              <li key={row.sessionId}>
                <Link
                  href={`/sign/${row.sessionId}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[color:var(--surface-muted)] transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <FileSignature
                      className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--text-secondary)]"
                      strokeWidth={2}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[color:var(--text-primary)]">
                        {row.sessionType ?? "supervision"} session
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-[color:var(--text-muted)]">
                        {format(row.date, "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]"
                    strokeWidth={2}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingPractice.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[color:var(--text-secondary)] mb-3">
            Practice hours to approve ({pendingPractice.length})
          </p>
          <PracticeReviewQueue entries={pendingPractice} />
        </div>
      )}
    </div>
  );
}
