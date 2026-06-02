import { eq } from "drizzle-orm";
import { CheckCircle2, XCircle, ShieldQuestion } from "lucide-react";
import { db, schema } from "@/lib/db";
import { canonicalJson, sha256Hex } from "@/lib/evidence";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Verify evidence — AuditHalo" };

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ packageId: string }>;
  searchParams: Promise<{ hash?: string }>;
}) {
  const { packageId } = await params;
  const { hash: providedHash } = await searchParams;

  if (!providedHash) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Badge variant="outline" className="mb-3">Verifier</Badge>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Provide a document hash to verify
        </h1>
        <p className="mt-3 text-foreground/70">
          Open the AuditHalo evidence PDF you received and find the SHA-256 hash
          on the last page. Append it as a query parameter, e.g.{" "}
          <span className="font-mono text-sm">
            /verify/{packageId}?hash=&lt;the-hash&gt;
          </span>
          .
        </p>
      </div>
    );
  }

  if (!/^[0-9a-f-]{36}$/i.test(packageId)) {
    return <Mismatch packageId={packageId} reason="Package ID is not a valid UUID." />;
  }

  const pkg = await db.query.evidencePackages.findFirst({
    where: eq(schema.evidencePackages.id, packageId),
  });

  if (!pkg) {
    return <Mismatch packageId={packageId} reason="No package with this ID exists in AuditHalo's registry." />;
  }

  const recomputed = sha256Hex(canonicalJson(pkg.documentContent));
  const matches =
    recomputed === providedHash && pkg.documentHash === providedHash;

  if (!matches) {
    return (
      <Mismatch
        packageId={packageId}
        reason="The hash you provided does not match the hash on record for this package. The PDF you have may have been tampered with, or you copied the hash incorrectly."
      />
    );
  }

  const doc = pkg.documentContent as {
    schemaVersion: string;
    generatedAt: string;
    rule: { jurisdiction: string; licenseCode: string; version: number };
    organization: { name: string };
    supervisee: { name: string };
    session: { date: string; durationHours: number; kind: string; signedAt: string };
    signatures: Array<{ signerName: string; signerRole: string; signedAt: string }>;
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Badge variant="success" className="mb-3">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Verified
      </Badge>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        This evidence package is genuine.
      </h1>
      <p className="mt-3 text-foreground/70">
        AuditHalo issued this package on{" "}
        <span className="font-mono">{doc.generatedAt.slice(0, 10)}</span>. The hash on
        the document you have matches the canonical hash on record.
      </p>

      <Card className="mt-8">
        <CardContent className="p-6 space-y-4">
          <Field label="Rule" value={`${doc.rule.jurisdiction} ${doc.rule.licenseCode} v${doc.rule.version}`} />
          <Field label="Organization" value={doc.organization.name} />
          <Field label="Supervisee" value={doc.supervisee.name} />
          <Field
            label="Session"
            value={`${doc.session.kind} · ${doc.session.date.slice(0, 10)} · ${doc.session.durationHours.toFixed(1)} hr`}
          />
          <Field label="Sealed at" value={doc.session.signedAt.replace("T", " ").slice(0, 19) + "Z"} />
          <div>
            <p className="label-overline mb-2">Signatures</p>
            <ul className="space-y-1 text-sm">
              {doc.signatures.map((s, i) => (
                <li key={i} className="text-foreground/80">
                  <span className="font-medium">{s.signerName}</span>{" "}
                  <span className="text-foreground/60">
                    ({s.signerRole}, signed {s.signedAt.replace("T", " ").slice(0, 19)}Z)
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-4 border-t border-border">
            <p className="label-overline mb-1">Canonical hash (SHA-256)</p>
            <p className="font-mono text-xs text-foreground/80 break-all">{providedHash}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Mismatch({ packageId, reason }: { packageId: string; reason: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Badge variant="critical" className="mb-3">
        <XCircle className="h-3.5 w-3.5" />
        Mismatch
      </Badge>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        This document does not match our records.
      </h1>
      <p className="mt-3 text-foreground/70">{reason}</p>
      <p className="mt-3 text-sm text-foreground/60 font-mono">
        Package ID: {packageId}
      </p>
      <Card className="mt-8">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <ShieldQuestion className="h-5 w-5 mt-0.5 text-foreground/50 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                What to do next
              </p>
              <p className="mt-2 text-sm text-foreground/70">
                Ask the person who sent you the PDF to re-export it from
                AuditHalo. If you continue to see this message, contact{" "}
                <a href="mailto:support@audithalo.com" className="text-secondary hover:underline">
                  support@audithalo.com
                </a>{" "}
                with this Package ID.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-overline mb-1">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
