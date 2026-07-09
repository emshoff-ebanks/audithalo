import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { getCurrentMembership } from "@/lib/authz";
import { EvidencePdf } from "@/components/pdf/EvidencePdf";
import { RiClinicalSupervisionPdf } from "@/components/pdf/RiClinicalSupervisionPdf";

// React-PDF needs Node APIs (Buffer, fs internals via dependencies); not Edge-compatible.
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new Response("Not authenticated", { status: 401 });

  const { id } = await ctx.params;

  const pkg = await db.query.evidencePackages.findFirst({
    where: eq(schema.evidencePackages.id, id),
  });
  if (!pkg) return new Response("Evidence package not found", { status: 404 });

  // Authorize: viewer must share an org with the supervisee
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || membership.orgId !== pkg.orgId) {
    return new Response("Forbidden", { status: 403 });
  }

  const docContent = pkg.documentContent as Record<string, unknown>;
  const templateKey =
    (docContent.pdfTemplateKey as string | undefined) ?? "audithalo_generic";

  const PdfComponent =
    templateKey === "recovery_innovations_v1"
      ? RiClinicalSupervisionPdf
      : EvidencePdf;

  const buffer = await renderToBuffer(
    <PdfComponent
      document={docContent as never}
      documentHash={pkg.documentHash}
      packageId={pkg.id}
    />
  );

  const supervisee = pkg.superviseeId
    ? await db.query.users.findFirst({
        where: eq(schema.users.id, pkg.superviseeId),
      })
    : null;
  const fileSafeName =
    (supervisee?.name ?? "supervisee").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const dateStr =
    ((docContent.session as { date?: string })?.date ?? "").slice(0, 10) ||
    "session";
  const filenamePrefix =
    templateKey === "recovery_innovations_v1"
      ? "ri-clinical-supervision"
      : "audithalo-evidence";
  const filename = `${filenamePrefix}-${fileSafeName}-${dateStr}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}
