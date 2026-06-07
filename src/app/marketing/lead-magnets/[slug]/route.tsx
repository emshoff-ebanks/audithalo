import { Document, renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import type { ReactElement } from "react";
import { NCAuditChecklistDocument } from "@/lib/lead-magnets/nc-audit-checklist";
import { NCLogTemplateDocument } from "@/lib/lead-magnets/nc-log-template";

export const runtime = "nodejs";

/**
 * Dynamic PDF route for lead-magnet downloads.
 *
 * GET /lead-magnets/<slug> → application/pdf
 *
 * The slug matches the MAGNETS registry in src/app/actions/lead-magnet.ts.
 * Each magnet renders its React-PDF document to a buffer on-demand
 * (~150ms typical). Static-export would be faster but ties us to a build
 * step every time we tweak content; on-demand keeps the docs editable
 * via plain TSX without redeploying.
 *
 * Content-Disposition: inline so the browser previews the PDF instead of
 * forcing a download dialog. Filename suggestion preserves the magnet
 * slug + .pdf when the user does choose to save.
 */

// Cast each renderer to the ReactElement<DocumentProps> shape react-pdf
// expects — Document is a class component there, and the inferred type
// from JSX isn't quite specific enough on its own.
const MAGNET_RENDERERS: Record<
  string,
  () => ReactElement<DocumentProps, typeof Document>
> = {
  "nc-supervision-audit-checklist": () =>
    (<NCAuditChecklistDocument />) as ReactElement<
      DocumentProps,
      typeof Document
    >,
  "nc-supervision-log-template": () =>
    (<NCLogTemplateDocument />) as ReactElement<
      DocumentProps,
      typeof Document
    >,
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const renderer = MAGNET_RENDERERS[slug];
  if (!renderer) {
    return new NextResponse("Lead magnet not found.", { status: 404 });
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(renderer());
  } catch (err) {
    console.error(`[lead-magnets] render failed for ${slug}:`, err);
    return new NextResponse("Failed to render lead magnet.", { status: 500 });
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${slug}.pdf"`,
      // Cache for 1 hour at the edge; bust by changing the slug or
      // bumping a version query param if we want a hard refresh.
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
