import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, FileSignature } from "lucide-react";
import { auth } from "@/auth";
import { getCurrentMembership, isManagerRole } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignForm } from "./sign-form";

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
  else if (isManagerRole(membership.role)) signerRole = "supervisor";

  const signatures = sessionEvent.signatures ?? [];
  const alreadySignedByMe = signatures.some(
    (s) => s.signerId === session.user.id
  );
  const fullySigned = !!sessionEvent.signedAt;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
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
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-sm bg-[color:var(--color-evidence-bg)]"
                  >
                    <div>
                      <p className="font-medium text-foreground">{s.signerName}</p>
                      <p className="text-xs text-foreground/60 capitalize">
                        {s.signerRole} ·{" "}
                        <span className="font-mono">
                          {new Date(s.signedAt).toISOString().slice(0, 16).replace("T", " ")}Z
                        </span>{" "}
                        · IP {s.ipAddress}
                      </p>
                    </div>
                    <FileSignature className="h-4 w-4 text-[color:var(--color-gold)]" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fullySigned ? (
            <div className="pt-4 border-t border-border">
              <Badge variant="success">Fully signed</Badge>
              <p className="mt-3 text-sm text-foreground/70">
                This session is sealed. Its evidence package is available on the
                supervisee's detail page.
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
                You aren't a required signer for this session.
              </p>
            </div>
          ) : (
            <SignForm sessionEventId={sessionEvent.id} signerRole={signerRole} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
