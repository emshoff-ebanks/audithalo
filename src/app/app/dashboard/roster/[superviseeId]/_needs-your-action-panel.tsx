import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, FileSignature } from "lucide-react";
import type { PendingSignatureRow } from "@/lib/supervisor-signatures";

type Props = {
  /** Signatures the viewer owes on THIS supervisee (already filtered). */
  pendingSignatures: PendingSignatureRow[];
};

/**
 * "Sessions to sign" side panel — the page-level urgent surface for a
 * supervisor viewing a specific supervisee, sized to live in the right
 * column next to Licensure progress. Practice-hours approvals used to
 * share this panel but their table doesn't fit a narrow column, so they
 * render as their own full-width block below the grid (see
 * PracticeReviewQueue usage in page.tsx).
 *
 * Renders nothing when empty — the absence is the signal.
 */
export function NeedsYourActionPanel({ pendingSignatures }: Props) {
  if (pendingSignatures.length === 0) {
    return null;
  }

  return (
    <div className="panel panel-flush overflow-hidden">
      <div className="px-5 py-4 border-b border-[color:var(--border)]">
        <p className="label-overline">
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
  );
}
