import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, FileSignature } from "lucide-react";
import { auth } from "@/auth";
import { canSupervise, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignForm } from "./sign-form";
import { SessionNoteForm } from "./session-note-form";
import { SessionNoteDisplay } from "./session-note-display";
import { ScheduledSessionCard } from "./scheduled-session-card";
import { DidntHappenAffordance } from "./didnt-happen-affordance";

export const metadata = {
  title: "Sign session — AuditHalo",
};

export default async function SignSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { sessionId } = await params;

  const sessionEvent = await db.query.sessionEvents.findFirst({
    where: eq(schema.sessionEvents.id, sessionId),
  });
  if (!sessionEvent) notFound();

  const membership = await getCurrentMembership(session.user.id);
  if (!membership || membership.orgId !== sessionEvent.orgId) notFound();

  const supervisee = await db.query.users.findFirst({
    where: eq(schema.users.id, sessionEvent.superviseeId),
  });
  if (!supervisee) notFound();

  // Who am I as a signer for this session?
  let signerRole: "supervisee" | "supervisor" | null = null;
  if (session.user.id === sessionEvent.superviseeId) signerRole = "supervisee";
  else if (canSupervise(membership.role)) signerRole = "supervisor";

  const signatures = sessionEvent.signatures ?? [];
  const alreadySignedByMe = signatures.some(
    (s) => s.signerId === session.user.id
  );
  const fullySigned = !!sessionEvent.signedAt;

  // Pre-meeting branch: if the row was created by scheduleSessionAction
  // AND the meeting hasn't ended yet, show the scheduled-session card
  // (Join button + cancel) instead of the post-meeting sign UI.
  const durationMinutes = Math.round(sessionEvent.durationHours * 60);
  const endMs = sessionEvent.date.getTime() + durationMinutes * 60_000;
  // Capture once at the top so the value is stable across the render.
  // Server Components run once per request — reading the clock here is
  // intentional. eslint-disable suppresses the overzealous purity rule.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const isPreMeeting =
    sessionEvent.scheduledStatus === "scheduled" && endMs > nowMs;
  const canCancelScheduled =
    isPreMeeting &&
    (sessionEvent.loggedById === session.user.id ||
      canSupervise(membership.role));
  // "Didn't attend" is widened to the supervisee on their own row — they
  // also need a way to record "the meeting time came and went and the
  // supervisor never showed" without escalating to email/Slack.
  const canMarkNoShow =
    isPreMeeting &&
    (canCancelScheduled || session.user.id === sessionEvent.superviseeId);

  if (isPreMeeting) {
    const scheduledForLocal = sessionEvent.timeZone
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: sessionEvent.timeZone,
          dateStyle: "full",
          timeStyle: "short",
        }).format(sessionEvent.date)
      : sessionEvent.date
          .toISOString()
          .slice(0, 16)
          .replace("T", " ") + " UTC";
    return (
      <div className="mx-auto max-w-2xl px-6 py-8 sm:py-12">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
          <Link href={`/dashboard/roster/${sessionEvent.superviseeId}`}>
            <ArrowLeft />
            Back to supervisee
          </Link>
        </Button>
        <Card className="mt-2">
          <CardContent className="p-6">
            <ScheduledSessionCard
              sessionId={sessionEvent.id}
              scheduledForUtcIso={sessionEvent.date.toISOString()}
              scheduledForLocal={scheduledForLocal}
              durationMinutes={durationMinutes}
              timeZone={sessionEvent.timeZone}
              meetingProvider={
                sessionEvent.meetingProvider as
                  | "teams"
                  | "google_meet"
                  | "in_person"
                  | null
              }
              meetingJoinUrl={sessionEvent.meetingJoinUrl}
              location={null}
              canCancel={canCancelScheduled}
              canReschedule={
                canCancelScheduled && !sessionEvent.recurringSeriesId
              }
              canMarkNoShow={canMarkNoShow}
              isRecurring={!!sessionEvent.recurringSeriesId}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Canceled branch: surface the status instead of dropping the user into
  // a sign UI that doesn't apply.
  if (sessionEvent.scheduledStatus === "canceled") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8 sm:py-12">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
          <Link href={`/dashboard/roster/${sessionEvent.superviseeId}`}>
            <ArrowLeft />
            Back to supervisee
          </Link>
        </Button>
        <Card>
          <CardContent className="p-6 space-y-3">
            <Badge variant="outline">Canceled</Badge>
            <h1 className="font-display text-2xl font-semibold text-foreground">
              This session was canceled
            </h1>
            <p className="text-sm text-foreground/70">
              No signature or transcript is required. The row stays in the audit
              log.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href={`/dashboard/roster/${sessionEvent.superviseeId}`}>
          <ArrowLeft />
          Back to supervisee
        </Link>
      </Button>

      <Badge variant="outline" className="mb-3">
        E-signature
      </Badge>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Sign this session
      </h1>
      <p className="mt-2 text-foreground/70">
        Your signature is recorded with your name, role, IP address, timestamp, and
        explicit intent confirmation. Once both the supervisee and supervisor have
        signed, the session is sealed and contributes to the evidence package for{" "}
        {supervisee.name}.
      </p>

      <Card className="mt-8">
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="label-overline mb-1">Date</p>
              <p className="font-mono text-foreground">
                {sessionEvent.date.toISOString().slice(0, 10)}
              </p>
            </div>
            <div>
              <p className="label-overline mb-1">Duration</p>
              <p className="font-mono text-foreground">
                {sessionEvent.durationHours.toFixed(1)} hr
              </p>
            </div>
            <div>
              <p className="label-overline mb-1">Kind</p>
              <p className="text-foreground capitalize">{sessionEvent.kind}</p>
            </div>
            <div>
              <p className="label-overline mb-1">Type</p>
              <p className="text-foreground capitalize">
                {sessionEvent.sessionType ?? "—"}
              </p>
            </div>
            {sessionEvent.supervisorCredentials && (
              <div className="col-span-2">
                <p className="label-overline mb-1">Supervisor credentials</p>
                <p className="font-mono text-xs text-foreground/80">
                  {sessionEvent.supervisorCredentials.join(", ")}
                </p>
              </div>
            )}
          </div>

          {signatures.length > 0 && (
            <div className="pt-4 border-t border-border">
              <p className="label-overline mb-3">Signatures</p>
              <ul className="space-y-2 text-sm">
                {signatures.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 px-3 py-2 rounded-sm bg-[color:var(--color-evidence-bg)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{s.signerName}</p>
                      <p className="text-xs text-foreground/60 capitalize break-words">
                        {s.signerRole} ·{" "}
                        <span className="font-mono">
                          {new Date(s.signedAt).toISOString().slice(0, 16).replace("T", " ")}Z
                        </span>{" "}
                        · IP {s.ipAddress}
                      </p>
                    </div>
                    <FileSignature className="h-4 w-4 mt-0.5 text-[color:var(--color-gold)] shrink-0" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI session note — supervisor-only, supervision-only, before sealing */}
          {sessionEvent.kind === "supervision" &&
            canSupervise(membership.role) && (
            <div className="pt-4 border-t border-border">
              {sessionEvent.aiNote ? (
                <SessionNoteDisplay
                  note={sessionEvent.aiNote as never}
                  sessionEventId={sessionEvent.id}
                  canEdit={canSupervise(membership.role) && !fullySigned}
                />
              ) : !fullySigned ? (
                <>
                  <p className="label-overline mb-3">AI session note</p>
                  <p className="text-sm text-foreground/70 mb-4">
                    Paste a transcript of this supervision session to generate a
                    structured note with topics, competencies, feedback, and next steps.
                    The transcript is sent to OpenAI but never stored — only the resulting
                    note is saved with this session.
                  </p>
                  <SessionNoteForm sessionEventId={sessionEvent.id} />
                </>
              ) : null}
            </div>
          )}

          {fullySigned ? (
            <div className="pt-4 border-t border-border">
              <Badge variant="success">Fully signed</Badge>
              <p className="mt-3 text-sm text-foreground/70">
                This session is sealed. Its evidence package is available on the
                supervisee&apos;s detail page.
              </p>
            </div>
          ) : alreadySignedByMe ? (
            <div className="pt-4 border-t border-border">
              <Badge variant="outline">Your signature is recorded</Badge>
              <p className="mt-3 text-sm text-foreground/70">
                Waiting for the other required signer.
              </p>
            </div>
          ) : signerRole === null ? (
            <div className="pt-4 border-t border-border">
              <Badge variant="outline">View only</Badge>
              <p className="mt-3 text-sm text-foreground/70">
                You aren&apos;t a required signer for this session.
              </p>
            </div>
          ) : (
            <SignForm sessionEventId={sessionEvent.id} signerRole={signerRole} />
          )}

          {/* Post-meeting "this didn't happen" escape hatch. Visible only
              when the row hasn't been signed yet, isn't already canceled/
              no_show, and the meeting's end time has passed. Mirrors the
              pre-meeting cancel/no-show buttons on ScheduledSessionCard
              so the same options are available regardless of which side
              of the meeting clock the user is on. */}
          {!fullySigned &&
            !alreadySignedByMe &&
            sessionEvent.scheduledStatus === "scheduled" &&
            endMs <= nowMs &&
            (canSupervise(membership.role) ||
              session.user.id === sessionEvent.superviseeId) && (
              <DidntHappenAffordance
                sessionId={sessionEvent.id}
                canCancel={
                  sessionEvent.loggedById === session.user.id ||
                  canSupervise(membership.role)
                }
              />
            )}
        </CardContent>
      </Card>
    </div>
  );
}
