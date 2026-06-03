import Link from "next/link";
import { ArrowRight, Eye, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Live demo — AuditHalo",
  description:
    "Try AuditHalo without signing up. Shared demo account with seeded supervisor + 3 supervisees at different compliance stages.",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <Badge variant="outline" className="mb-4">
        <Eye className="h-3.5 w-3.5" />
        Live demo
      </Badge>
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
        See AuditHalo in action.
      </h1>
      <p className="mt-3 text-foreground/70 text-lg">
        A shared demo account, pre-seeded with three NC LCMHCA supervisees at different
        compliance stages. Sign in, click around — no signup required.
      </p>

      <Card className="mt-8">
        <CardContent className="p-6 sm:p-8">
          <p className="label-overline mb-3">Demo credentials</p>
          <dl className="space-y-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-3">
              <dt className="text-foreground/60 min-w-[100px]">Email</dt>
              <dd className="font-mono text-foreground bg-accent px-2 py-1 rounded-sm">
                demo-supervisor@audithalo.com
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <dt className="text-foreground/60 min-w-[100px]">Password</dt>
              <dd className="font-mono text-foreground bg-accent px-2 py-1 rounded-sm">
                Demo1234!
              </dd>
            </div>
          </dl>
          <Button asChild className="mt-6">
            <a href="https://app.audithalo.com/login">
              Sign in to the demo <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6 border-[color:var(--color-warning)]/30">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--color-warning)]" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-medium text-foreground">
                This is a shared demo — please be respectful.
              </p>
              <p className="mt-2 text-sm text-foreground/70">
                Other prospects use the same account. Don&apos;t paste sensitive
                content. Don&apos;t change settings you wouldn&apos;t want others to
                see. We re-seed the demo periodically, so any changes you make may
                disappear.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          What you&apos;ll see in the demo
        </h2>
        <ul className="space-y-3 text-sm text-foreground/80">
          <li className="flex gap-3">
            <span className="text-foreground/40">·</span>
            <span>
              <strong>Supervisor dashboard</strong> with live compliance metrics across 3
              supervisees (one at 65%, one at 15% with red-flagged risk, one at 95%).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-foreground/40">·</span>
            <span>
              <strong>Roster</strong> with rule assignments, progress bars, and pending
              signature counts.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-foreground/40">·</span>
            <span>
              <strong>Per-supervisee detail</strong> showing the NC LCMHCA rule, gaps,
              session log, and evidence packages.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-foreground/40">·</span>
            <span>
              <strong>AI session note</strong> — one supervision session has an AI-generated
              structured note attached, showing topics, competencies, feedback, and next
              steps.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-foreground/40">·</span>
            <span>
              <strong>Evidence package PDF</strong> with SHA-256 hash, signatures, and the
              public verify URL.
            </span>
          </li>
        </ul>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/pricing">
            See pricing <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/for-supervisors">
            For supervisors <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild>
          <a href="https://app.audithalo.com/register">
            Create your own account
          </a>
        </Button>
      </div>
    </div>
  );
}
