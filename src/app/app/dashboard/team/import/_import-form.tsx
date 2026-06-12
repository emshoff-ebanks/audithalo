"use client";

import { useActionState, useState } from "react";
import { Upload, AlertTriangle, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  previewHrisImportAction,
  commitHrisImportAction,
  type PreviewResult,
  type CommitResult,
} from "@/app/actions/hris-import";

const TEMPLATE_CSV = `email,name,role,primary_supervisor_email,rule_id,obligation_started_at,external_id
alex.intern@example.com,Alex Intern,supervisee,sandra.lcsw@example.com,nc-lcmhca-v1,2025-09-01,EMP-1042
sandra.lcsw@example.com,Sandra LCSW,supervisor,,,,EMP-0007
jordan.cfo@example.com,Jordan CFO,executive,,,,EMP-2001
`;

export function ImportForm() {
  const [csv, setCsv] = useState("");
  const [previewState, previewAction, previewPending] = useActionState<
    PreviewResult | undefined,
    FormData
  >(previewHrisImportAction, undefined);
  const [commitState, commitAction, commitPending] = useActionState<
    CommitResult | undefined,
    FormData
  >(commitHrisImportAction, undefined);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audithalo-hris-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    setCsv(text);
  };

  const preview = previewState?.ok ? previewState : null;
  const previewErr = previewState && !previewState.ok ? previewState.error : null;
  const commit = commitState?.ok ? commitState : null;
  const commitErr = commitState && !commitState.ok ? commitState.error : null;

  const hasErrors = preview ? preview.errors.length > 0 : false;
  const showCommit =
    preview && preview.errors.length === 0 && preview.rows.length > 0 && !commit;

  return (
    <div className="space-y-6">
      {/* Step 1: paste or upload */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            type="file"
            accept=".csv,text/csv"
            id="csv-file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <Button asChild variant="outline" size="sm">
            <label htmlFor="csv-file" className="cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              Upload CSV file
            </label>
          </Button>
          <Button onClick={downloadTemplate} variant="ghost" size="sm">
            Download template
          </Button>
        </div>

        <div>
          <Label htmlFor="csv-text">…or paste CSV</Label>
          <textarea
            id="csv-text"
            name="csv"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={8}
            placeholder="email,name,role,primary_supervisor_email"
            className="mt-2 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm font-mono text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1.5 text-xs text-foreground/60 leading-relaxed">
            Required: <span className="font-mono">email</span>,{" "}
            <span className="font-mono">name</span>,{" "}
            <span className="font-mono">role</span> (supervisor, supervisee, or
            executive). Optional:{" "}
            <span className="font-mono">primary_supervisor_email</span>,{" "}
            <span className="font-mono">rule_id</span>,{" "}
            <span className="font-mono">obligation_started_at</span>,{" "}
            <span className="font-mono">external_id</span> — your HRIS
            employee ID (e.g., EMP-1042). Stored on the member record so a
            later sync can match rows back to your system. Leave blank if you
            don&apos;t track one.
          </p>
        </div>

        <form action={previewAction}>
          <input type="hidden" name="csv" value={csv} />
          <Button type="submit" disabled={previewPending || csv.trim().length === 0}>
            {previewPending ? "Validating…" : "Validate & preview"}
            {!previewPending && <ArrowRight />}
          </Button>
        </form>

        {previewErr && (
          <p
            role="alert"
            className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
          >
            {previewErr}
          </p>
        )}
      </div>

      {/* Step 2: preview */}
      {preview && (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Preview
          </h2>

          {preview.unrecognizedHeaders.length > 0 && (
            <p className="text-xs text-foreground/60">
              Ignored columns: {preview.unrecognizedHeaders.join(", ")}
            </p>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">
              {preview.rows.length} valid {preview.rows.length === 1 ? "row" : "rows"}
            </Badge>
            <Badge variant="outline">
              {preview.superviseeRowCount} new {preview.superviseeRowCount === 1 ? "supervisee" : "supervisees"}
              {preview.seatCapRemaining !== null && (
                <span className="ml-1 text-foreground/60">
                  · {preview.seatCapRemaining} seat
                  {preview.seatCapRemaining === 1 ? "" : "s"} left
                </span>
              )}
            </Badge>
            <Badge variant="outline">
              {preview.executiveRowCount} new exec
              {preview.executiveRowCount === 1 ? "" : "s"} · {preview.executiveSeatsRemaining} seat
              {preview.executiveSeatsRemaining === 1 ? "" : "s"} left
            </Badge>
            {preview.errors.length > 0 && (
              <Badge variant="risk">
                {preview.errors.length} error{preview.errors.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>

          {preview.errors.length > 0 && (
            <div className="p-3 rounded-sm border border-[color:var(--color-risk)]/30 bg-[color:var(--color-risk)]/5 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--color-risk)]" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    Fix these before importing:
                  </p>
                  <ul className="mt-1.5 space-y-1 text-xs font-mono text-foreground/80">
                    {preview.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>
                        {e.rowNumber === 0 ? "header" : `row ${e.rowNumber}`} · {e.field} — {e.message}
                      </li>
                    ))}
                    {preview.errors.length > 20 && (
                      <li className="text-foreground/50">
                        + {preview.errors.length - 20} more…
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {preview.rows.length > 0 && (
            <div className="overflow-x-auto rounded-sm border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs uppercase tracking-wide text-foreground/60">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Supervisor</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 100).map((r) => (
                    <tr
                      key={r.rowNumber}
                      className={`border-t border-border ${r.conflict ? "text-foreground/50" : "text-foreground"}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{r.rowNumber}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                      <td className="px-3 py-2">{r.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs">
                          {r.role}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.primarySupervisorEmail ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.conflict === "existing_member" && (
                          <span className="text-foreground/60">Already a member · skip</span>
                        )}
                        {r.conflict === "open_invite" && (
                          <span className="text-foreground/60">Open invite · skip</span>
                        )}
                        {!r.conflict && (
                          <span className="text-[color:var(--color-success)]">
                            New invite
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 100 && (
                <p className="p-3 text-xs text-foreground/50">
                  Showing first 100 of {preview.rows.length} rows.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: commit */}
      {showCommit && (
        <form action={commitAction} className="pt-2 border-t border-border">
          <input type="hidden" name="csv" value={csv} />
          <Button type="submit" disabled={commitPending || hasErrors}>
            <Check className="h-4 w-4" />
            {commitPending ? "Sending invitations…" : `Send ${preview!.rows.length} invitation${preview!.rows.length === 1 ? "" : "s"}`}
          </Button>
        </form>
      )}

      {commitErr && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-risk)] bg-[color:var(--color-risk)]/8 px-3 py-2 rounded-sm"
        >
          {commitErr}
        </p>
      )}

      {commit && (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Import complete
          </h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="success">{commit.created} created</Badge>
            {commit.skipped > 0 && <Badge variant="outline">{commit.skipped} skipped</Badge>}
            {commit.failed > 0 && <Badge variant="risk">{commit.failed} failed</Badge>}
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-foreground/70 hover:text-foreground">
              Per-row outcome ({commit.perRow.length} {commit.perRow.length === 1 ? "row" : "rows"})
            </summary>
            <ul className="mt-2 space-y-1 text-xs font-mono">
              {commit.perRow.map((r) => (
                <li key={r.rowNumber} className="flex gap-2">
                  <span className="text-foreground/50 w-12">row {r.rowNumber}</span>
                  <span className="w-64 truncate">{r.email}</span>
                  <span
                    className={
                      r.outcome === "created"
                        ? "text-[color:var(--color-success)]"
                        : r.outcome === "skipped"
                          ? "text-foreground/60"
                          : "text-[color:var(--color-risk)]"
                    }
                  >
                    {r.outcome}
                    {r.reason ? ` — ${r.reason}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
