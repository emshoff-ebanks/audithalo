import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentMembership } from "@/lib/authz";
import { redeemAuditLogExport } from "@/app/actions/audit-log-export";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/audit-log/export?token=<one-time>
 *
 * Two-step export: the UI calls prepareAuditLogExport() to get a token
 * (with TOTP verification for HR Admin), then redirects here to actually
 * stream the file. Keeps the 2FA code out of the URL and gives us a place
 * to inject Content-Disposition headers + pick CSV vs JSON formatting.
 *
 * Cap at 10,000 rows server-side. Larger exports would need paginated
 * streaming or a background job — not needed at our scale.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return new NextResponse("Missing export token.", { status: 400 });
  }

  // Authenticate BEFORE redeeming. A leaked token in a screen-share URL bar
  // or referer header would otherwise let an anonymous attacker download up
  // to 10,000 audit rows of org PII within the 60-second TTL.
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Sign in required.", { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return new NextResponse("No organization.", { status: 403 });
  }

  const redeem = await redeemAuditLogExport(token);
  if (!redeem.ok) {
    return new NextResponse(redeem.error, { status: 410 });
  }

  // The token must belong to this user AND this user's current org.
  // Cross-user / cross-org redemption of a leaked token is rejected here.
  if (
    session.user.id !== redeem.requestedById ||
    membership.orgId !== redeem.orgId
  ) {
    return new NextResponse("Export token does not match this session.", {
      status: 403,
    });
  }

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, redeem.orgId),
    columns: { name: true },
  });

  const entries = await db.query.auditLogEntries.findMany({
    where: eq(schema.auditLogEntries.orgId, redeem.orgId),
    orderBy: [desc(schema.auditLogEntries.createdAt)],
    limit: 10_000,
  });

  // Resolve actor emails for human-readable export.
  const actorIds = Array.from(
    new Set(
      entries
        .map((e) => e.actorUserId)
        .filter((id): id is string => id !== null)
    )
  );
  const actors =
    actorIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(schema.users.id, actorIds),
          columns: { id: true, email: true },
        })
      : [];
  const actorEmailById = new Map(actors.map((u) => [u.id, u.email]));

  // Filename: audithalo-audit-log-<orgname>-<yyyymmdd>.<ext>
  const orgSlug = (org?.name ?? "org")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const datestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `audithalo-audit-log-${orgSlug}-${datestamp}.${redeem.format}`;

  let body: string;
  let contentType: string;

  if (redeem.format === "csv") {
    const rows: string[] = [
      [
        "created_at",
        "action",
        "actor_email",
        "resource_type",
        "resource_id",
        "ip_address",
        "details_json",
        "org_id",
      ].join(","),
    ];
    for (const e of entries) {
      const actorEmail = e.actorUserId
        ? actorEmailById.get(e.actorUserId) ?? ""
        : "";
      rows.push(
        [
          e.createdAt.toISOString(),
          csvCell(e.action),
          csvCell(actorEmail),
          csvCell(e.resourceType ?? ""),
          csvCell(e.resourceId ?? ""),
          csvCell(e.ipAddress ?? ""),
          csvCell(JSON.stringify(e.details ?? {})),
          e.orgId,
        ].join(",")
      );
    }
    body = rows.join("\n");
    contentType = "text/csv; charset=utf-8";
  } else {
    body = JSON.stringify(
      entries.map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        action: e.action,
        actorEmail: e.actorUserId
          ? actorEmailById.get(e.actorUserId) ?? null
          : null,
        actorUserId: e.actorUserId,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        ipAddress: e.ipAddress,
        details: e.details,
        orgId: e.orgId,
      })),
      null,
      2
    );
    contentType = "application/json; charset=utf-8";
  }

  // Final audit entry — the export actually completed.
  try {
    await logAuditEvent({
      orgId: redeem.orgId,
      actorUserId: redeem.requestedById,
      action: AUDIT_ACTIONS.AUDIT_LOG_EXPORTED,
      resourceType: "audit_log",
      details: {
        phase: "delivered",
        format: redeem.format,
        rowCount: entries.length,
      },
    });
  } catch (err) {
    console.error("[audit-export] delivery audit failed:", err);
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Escape a CSV cell. Two concerns:
 *  1. Standard CSV quoting (comma, quote, newline).
 *  2. CSV/spreadsheet formula injection — a cell starting with =, +, -, @,
 *     tab, or CR is interpreted as a formula by Excel/Sheets/Numbers when
 *     the file is opened. Prefix-quote those values so they render as text.
 *     See OWASP "CSV Injection."
 */
function csvCell(value: string): string {
  const needsFormulaGuard = /^[=+\-@\t\r]/.test(value);
  const guarded = needsFormulaGuard ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}
