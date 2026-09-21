import Link from "next/link";
import { db, schema } from "@/lib/db";
import { loadAllRules } from "@/lib/rules";

export const metadata = { title: "Rule drift — Admin" };
export const dynamic = "force-dynamic";

function relTime(date: Date | null): string {
  if (!date) return "never";
  const ms = Date.now() - date.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export default async function RuleDriftPage() {
  const snapshots = await db.select().from(schema.ruleSourceSnapshots);
  const byRuleId = new Map(snapshots.map((s) => [s.ruleId, s]));
  const rules = [...loadAllRules().values()].sort((a, b) =>
    `${a.jurisdiction}-${a.license_code}-v${a.version}`.localeCompare(
      `${b.jurisdiction}-${b.license_code}-v${b.version}`
    )
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="shell-page-title">Rule source drift</h1>
        <p className="shell-page-sub max-w-3xl">
          Weekly cron fetches each rule&apos;s citation URL, hashes the body,
          and flags any change. Status <strong>changed</strong> means the page
          moved or its content differs from what we last verified — read the
          page, decide if the rule needs a new version YAML, then update
          verification.last_verified_at + source_hash to clear the flag.
        </p>
      </div>

      <div className="panel panel-flush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[color:var(--border)] bg-[color:var(--surface-muted)]">
              <th className="px-4 py-3 label-overline">Rule</th>
              <th className="px-4 py-3 label-overline">Status</th>
              <th className="px-4 py-3 label-overline">Last checked</th>
              <th className="px-4 py-3 label-overline">Last changed</th>
              <th className="px-4 py-3 label-overline">Source</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const ruleId =
                `${r.jurisdiction}-${r.license_code}-v${r.version}`.toLowerCase();
              const snap = byRuleId.get(ruleId);
              const status = snap?.status ?? "unseen";
              const pill =
                status === "changed"
                  ? "status-warn"
                  : status === "error"
                    ? "status-risk"
                    : status === "ok"
                      ? "status-ok"
                      : "status-pending";
              return (
                <tr key={ruleId} className="border-b border-[color:var(--divider)]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[color:var(--text-primary)]">
                      {r.jurisdiction} {r.license_code} v{r.version}
                    </p>
                    <p className="text-xs text-[color:var(--text-muted)] font-mono">
                      {ruleId}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status-pill ${pill}`}>{status}</span>
                    {snap?.errorMessage && (
                      <p className="mt-1 text-xs text-[color:var(--risk-600)]">
                        {snap.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                    {relTime(snap?.lastCheckedAt ?? null)}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                    {relTime(snap?.lastChangedAt ?? null)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={r.citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[color:var(--text-primary)] underline text-xs"
                    >
                      Open ↗
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
