import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership, isHrAdmin } from "@/lib/authz";
import { pendingSignaturesForSupervisor } from "@/lib/supervisor-signatures";
import { InitialsAvatar } from "@/components/ui/initials-avatar";

export const metadata = { title: "Signature queue — AuditHalo" };

const DAY_MS = 24 * 60 * 60_000;
const rowDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export default async function SignatureQueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) redirect("/login");
  if (!canSupervise(membership.role) && !isHrAdmin(membership.role)) {
    redirect("/dashboard");
  }

  // Only supervisors are required signers; HR Admin sees an empty queue.
  const pending = canSupervise(membership.role)
    ? await pendingSignaturesForSupervisor(session.user.id, membership.orgId)
    : [];

  // Server Components render once per request — reading the clock here is
  // intentional and stable across the render.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const count = pending.length;

  return (
    <>
      <div>
        <p className="shell-eyebrow">Sign to seal</p>
        <h1 className="shell-page-title mt-1">Signature queue</h1>
        <p className="shell-page-sub">
          {count === 0
            ? "Nothing waiting on your signature."
            : `${count} session${count === 1 ? "" : "s"} waiting on your signature, oldest first.`}
        </p>
      </div>

      {count === 0 ? (
        <div className="panel">
          <p className="py-10 text-center text-sm text-[color:var(--text-muted)]">
            You&apos;re all caught up. Nothing awaits your signature.
          </p>
        </div>
      ) : (
        <div className="panel panel-flush overflow-hidden">
          {pending.map((row, idx) => {
            const days = Math.floor((nowMs - row.date.getTime()) / DAY_MS);
            const age =
              days <= 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`;
            // Subtle zebra so rows don't blend together, especially in dark
            // mode. Skipped on odd rows so hover still stands out.
            const zebra =
              idx % 2 === 1 ? "bg-black/[0.025] dark:bg-white/[0.035]" : "";
            return (
              <Link
                key={row.sessionId}
                href={`/sign/${row.sessionId}`}
                className={`flex items-center gap-3 px-5 py-4 border-b border-[color:var(--divider)] last:border-b-0 hover:bg-[color:var(--surface-muted)] transition-colors ${zebra}`}
              >
                <InitialsAvatar name={row.superviseeName} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[color:var(--text-primary)] truncate">
                    {row.superviseeName}
                  </p>
                  <p className="text-xs text-[color:var(--text-secondary)] capitalize">
                    {row.sessionType ?? "supervision"} session
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm text-[color:var(--text-primary)]">
                    {rowDate.format(row.date)}
                  </p>
                  <p className="font-mono text-xs text-[color:var(--text-muted)]">
                    {age}
                  </p>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]"
                  strokeWidth={2}
                />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
