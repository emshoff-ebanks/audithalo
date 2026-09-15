import { eq } from "drizzle-orm";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  XCircle,
  ShieldQuestion,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { db, schema } from "@/lib/db";
import { canonicalJson, sha256Hex } from "@/lib/evidence";
import { Badge } from "@/components/ui/badge";
import { SealMedallion } from "@/components/marketing/seal-medallion";
import { VerifySearch } from "@/components/marketing/verify-search";

export const metadata = {
  title: "Verify an evidence package — AuditHalo",
  description:
    "Confirm that an AuditHalo supervision evidence package is genuine and unaltered. No login required — the SHA-256 content hash is recomputed and checked against the sealed record.",
};

const APP_URL = "https://app.audithalo.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EvidenceDoc = {
  schemaVersion: string;
  generatedAt: string;
  rule: {
    jurisdiction: string;
    licenseCode: string;
    licenseName?: string;
    version: number;
    citation?: string;
  };
  organization: { name: string };
  supervisee: { name: string; state?: string | null; licenseType?: string | null };
  session: {
    date: string;
    durationHours: number;
    kind: string;
    sessionType?: string | null;
    signedAt: string;
  };
  signatures: Array<{
    signerName: string;
    signerRole: string;
    signedAt: string;
    credential?: string;
  }>;
};

function ts(value: string): string {
  return value.replace("T", " ").slice(0, 19) + " UTC";
}

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ packageId: string }>;
  searchParams: Promise<{ hash?: string }>;
}) {
  const { packageId } = await params;
  const { hash: providedHashRaw } = await searchParams;
  const providedHash = providedHashRaw?.toLowerCase();

  if (!UUID_RE.test(packageId)) {
    return (
      <Shell packageId={packageId}>
        <NotGenuine
          title="That isn't a valid package ID."
          reason="An AuditHalo evidence package ID is a UUID. Check that you copied the whole ID (or paste the full verify URL above)."
          packageId={packageId}
        />
      </Shell>
    );
  }

  const pkg = await db.query.evidencePackages.findFirst({
    where: eq(schema.evidencePackages.id, packageId),
  });

  if (!pkg) {
    return (
      <Shell packageId={packageId}>
        <NotGenuine
          title="No package with this ID is on record."
          reason="AuditHalo has no evidence package registered under this ID. It may have been mistyped, or this document was not sealed by AuditHalo."
          packageId={packageId}
        />
      </Shell>
    );
  }

  // The integrity check: recompute the SHA-256 of the canonical document and
  // compare against the hash stored at sealing time. Equal => the record is
  // provably unaltered since it was sealed.
  const recomputed = sha256Hex(canonicalJson(pkg.documentContent));
  const sealIntact = recomputed === pkg.documentHash;

  if (!sealIntact) {
    return (
      <Shell packageId={packageId}>
        <NotGenuine
          title="This record failed its integrity check."
          reason="The stored document no longer matches the hash it was sealed with. Do not rely on this package — contact support@audithalo.com with the package ID."
          packageId={packageId}
        />
      </Shell>
    );
  }

  // Optional cross-check against the hash carried in the verify link (printed
  // on the sealed PDF). Soft signal — the record above is authoritative.
  const copyProvided = Boolean(providedHash);
  const copyMatches = copyProvided ? providedHash === recomputed : null;

  const doc = pkg.documentContent as EvidenceDoc;
  const supervisor = doc.signatures.find((s) =>
    s.signerRole.toLowerCase().includes("supervisor")
  );
  const modality = doc.session.sessionType || doc.session.kind;

  return (
    <Shell packageId={packageId}>
      <div className="relative overflow-hidden rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-[color:var(--seal-gold)]" />

        {/* Status header */}
        <div className="flex flex-col gap-5 border-b border-[color:var(--ink-100)] p-6 sm:flex-row sm:items-start sm:p-8">
          <SealMedallion size={72} />
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--sage-500)]/15 px-2.5 py-1 font-mono text-xs font-semibold text-[color:var(--sage-700)]">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Seal valid · hash matches
            </span>
            <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-[color:var(--ink-900)]">
              {titleCase(modality)} · {doc.supervisee.name}
            </h1>
            <p className="mt-1 font-mono text-sm text-[color:var(--ink-500)]">
              Sealed {ts(doc.session.signedAt)} · governed by {doc.rule.jurisdiction}{" "}
              {doc.rule.licenseCode} v{doc.rule.version}
            </p>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          {/* Holder-copy cross-check */}
          {copyProvided &&
            (copyMatches ? (
              <p className="flex items-center gap-2 text-sm text-[color:var(--sage-700)]">
                <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
                The hash in your link matches this record.
              </p>
            ) : (
              <div className="flex items-start gap-2.5 rounded-md border border-[color:var(--warn-500)] bg-[color:var(--warn-50)] p-3.5">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warn-700)]"
                  strokeWidth={2}
                />
                <p className="text-sm text-[color:var(--warn-700)]">
                  The hash in your link doesn&apos;t match this record. Double-check
                  you copied the full hash — or the copy you hold may differ from
                  the sealed record shown here, which is authoritative.
                </p>
              </div>
            ))}

          {/* Canonical hash */}
          <div className="rounded-md bg-[color:var(--paper-100)] p-3.5">
            <div className="label-overline">SHA-256 content hash</div>
            <code className="mt-1 block break-all font-mono text-xs leading-relaxed text-[color:var(--ink-800)]">
              {recomputed}
            </code>
          </div>

          {/* Signed fields */}
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <VField label="Package ID" value={packageId} mono />
            <VField label="Session date" value={ts(doc.session.date)} />
            <VField label="Modality" value={titleCase(modality)} />
            <VField
              label="Duration"
              value={`${doc.session.durationHours.toFixed(1)} hr`}
            />
            <VField
              label="Supervisor"
              value={supervisor ? supervisor.signerName : "—"}
            />
            <VField label="Supervisee" value={doc.supervisee.name} />
            <VField label="Organization" value={doc.organization.name} />
            <VField
              label="Rule version"
              value={`${doc.rule.citation ?? `${doc.rule.jurisdiction} ${doc.rule.licenseCode}`} · v${doc.rule.version}`}
            />
          </dl>

          {/* Signatures */}
          <div>
            <div className="label-overline mb-2">
              Signatures · {doc.signatures.length} of {doc.signatures.length}
            </div>
            <ul className="grid gap-1.5">
              {doc.signatures.map((s, i) => (
                <li key={i} className="text-sm text-[color:var(--ink-700)]">
                  <span className="font-medium text-[color:var(--ink-900)]">
                    {s.signerName}
                  </span>{" "}
                  <span className="text-[color:var(--ink-500)]">
                    · {titleCase(s.signerRole)} · signed {ts(s.signedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--ink-100)] pt-5">
            <a
              href={`${APP_URL}/api/evidence/${packageId}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-[color:var(--ink-900)] px-6 text-sm font-medium text-[color:var(--paper-50)] transition-colors hover:bg-[color:var(--ink-800)]"
            >
              <FileText className="h-4 w-4" strokeWidth={2} />
              Download the sealed PDF
            </a>
            <a
              href={`mailto:support@audithalo.com?subject=Evidence%20package%20${packageId}`}
              className="text-sm text-[color:var(--ink-600)] underline decoration-[color:var(--ink-300)] underline-offset-2 hover:text-[color:var(--ink-900)]"
            >
              Report an issue
            </a>
          </div>
        </div>
      </div>

      <HowItWorks />
    </Shell>
  );
}

function Shell({
  packageId,
  children,
}: {
  packageId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <Badge variant="outline" className="mb-4">
        Public verification
      </Badge>
      <div className="mb-8 max-w-xl">
        <VerifySearch defaultValue={packageId} />
      </div>
      {children}
    </div>
  );
}

function NotGenuine({
  title,
  reason,
  packageId,
}: {
  title: string;
  reason: string;
  packageId: string;
}) {
  return (
    <div className="rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] p-6 sm:p-8">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--risk-700)]/10 px-2.5 py-1 font-mono text-xs font-semibold text-[color:var(--risk-700)]">
        <XCircle className="h-3.5 w-3.5" strokeWidth={2.5} />
        Not verified
      </span>
      <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-[color:var(--ink-900)]">
        {title}
      </h1>
      <p className="mt-3 text-[color:var(--ink-600)] leading-relaxed">{reason}</p>
      <p className="mt-3 break-all font-mono text-xs text-[color:var(--ink-500)]">
        Package ID: {packageId}
      </p>
      <div className="mt-6 flex items-start gap-3 border-t border-[color:var(--ink-100)] pt-5">
        <ShieldQuestion
          className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--ink-500)]"
          strokeWidth={2}
        />
        <p className="text-sm text-[color:var(--ink-600)]">
          Ask whoever sent you the document to re-export it from AuditHalo, or
          email{" "}
          <a
            href="mailto:support@audithalo.com"
            className="text-[color:var(--ink-700)] underline underline-offset-2 hover:text-[color:var(--ink-900)]"
          >
            support@audithalo.com
          </a>{" "}
          with the package ID above.
        </p>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="mt-8 rounded-[14px] border border-[color:var(--ink-200)] bg-[color:var(--paper-100)] p-6">
      <div className="label-overline mb-2">How this check works</div>
      <p className="text-sm leading-relaxed text-[color:var(--ink-600)]">
        Every AuditHalo package is sealed by hashing its canonical record with
        SHA-256. This page recomputes that hash from the stored record and
        confirms it matches the hash captured at sealing — so any change to the
        content, however small, would break the seal. The record shown here is
        the authoritative one. See the{" "}
        <Link
          href="/docs/evidence/verifying-a-package"
          className="text-[color:var(--ink-900)] underline decoration-[color:var(--halo-yellow)] decoration-2 underline-offset-2"
        >
          verification guide
        </Link>
        .
      </p>
    </div>
  );
}

function VField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md bg-[color:var(--paper-100)] p-3">
      <dt className="label-overline mb-1">{label}</dt>
      <dd
        className={`text-sm text-[color:var(--ink-900)] ${
          mono ? "break-all font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function titleCase(s: string): string {
  return s.replace(/(^|[\s_-])(\w)/g, (_, sep, ch) => sep + ch.toUpperCase());
}
