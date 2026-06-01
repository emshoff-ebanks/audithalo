import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { getCurrentMembership } from "@/lib/authz";
import { EvidencePdf } from "@/components/pdf/EvidencePdf";

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

  const buffer = await renderToBuffer(
    <EvidencePdf
      document={pkg.documentContent as never}
      documentHash={pkg.documentHash}
    />
  );

  const supervisee = await db.query.users.findFirst({
    where: eq(schema.users.id, pkg.superviseeId),
  });
  const fileSafeName =
    (supervisee?.name ?? "supervisee").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const dateStr =
    ((pkg.documentContent as { session?: { date?: string } })?.session?.date ?? "")
      .slice(0, 10) || "session";
  const filename = `audithalo-evidence-${fileSafeName}-${dateStr}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}
