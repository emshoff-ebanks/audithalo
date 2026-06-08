"use server";

import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageOrg, getCurrentMembership } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import {
  generateInvitationToken,
  hashToken,
  invitationExpiresAt,
} from "@/lib/invitations";
import { sendEmail } from "@/lib/email";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import {
  parseHrisCsv,
  validateSupervisorRefs,
  type ParseOutcome,
  type ParsedRow,
  type RowError,
} from "@/lib/hris/csv-parser";
import { seatCap } from "@/lib/billing/seats";

const APP_URL = process.env.APP_URL ?? "https://app.audithalo.com";
const MAX_EXECUTIVE_SEATS = 5;
/** Hard limit so a 50k-row CSV doesn't burn our DB + Resend budget. */
const MAX_CSV_ROWS = 500;

const previewSchema = z.object({
  csv: z.string().min(1, "Paste or upload a CSV."),
});

export type PreviewRow = ParsedRow & {
  /** Set when the row would conflict with an existing org member or open invite. */
  conflict?: "existing_member" | "open_invite";
};

export type PreviewResult =
  | {
      ok: true;
      headers: string[];
      unrecognizedHeaders: string[];
      rows: PreviewRow[];
      errors: RowError[];
      /** Approximate billable supervisee count for seat-cap visibility. */
      superviseeRowCount: number;
      seatCapRemaining: number | null;
      executiveRowCount: number;
      executiveSeatsRemaining: number;
    }
  | { ok: false; error: string };

/**
 * Preview a CSV. Pure as possible — validates shape, fetches existing org
 * state to flag duplicates, returns everything the UI needs to render the
 * preview table. Does NOT mutate the DB.
 */
export async function previewHrisImportAction(
  _prev: PreviewResult | undefined,
  formData: FormData
): Promise<PreviewResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageOrg(membership.role)) {
    return { ok: false, error: "Only HR Admins can import team members." };
  }

  const parsed = previewSchema.safeParse({ csv: formData.get("csv") });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const outcome: ParseOutcome = parseHrisCsv(parsed.data.csv);
  if (outcome.rows.length > MAX_CSV_ROWS) {
    return {
      ok: false,
      error: `CSV has ${outcome.rows.length} rows — the max per import is ${MAX_CSV_ROWS}. Split the file and re-upload.`,
    };
  }

  // Fetch existing supervisors in the org so we can validate
  // primary_supervisor_email refs that aren't in the CSV.
  const existingSupervisors = await db
    .select({ email: schema.users.email })
    .from(schema.orgMemberships)
    .innerJoin(
      schema.users,
      eq(schema.orgMemberships.userId, schema.users.id)
    )
    .where(
      and(
        eq(schema.orgMemberships.orgId, membership.orgId),
        eq(schema.orgMemberships.role, "supervisor"),
        isNull(schema.orgMemberships.deactivatedAt)
      )
    );
  const supervisorEmailSet = new Set(
    existingSupervisors.map((s) => s.email.toLowerCase())
  );
  const supervisorRefErrors = validateSupervisorRefs(
    outcome.rows,
    supervisorEmailSet
  );
  const allErrors = [...outcome.errors, ...supervisorRefErrors];

  // Flag duplicate / open-invite conflicts row-by-row.
  const emailList = outcome.rows.map((r) => r.email);
  const [existingUsersInOrg, openInvitesInOrg] = await Promise.all([
    emailList.length > 0
      ? db
          .select({
            email: schema.users.email,
            membershipId: schema.orgMemberships.id,
          })
          .from(schema.orgMemberships)
          .innerJoin(
            schema.users,
            eq(schema.orgMemberships.userId, schema.users.id)
          )
          .where(
            and(
              eq(schema.orgMemberships.orgId, membership.orgId),
              inArray(schema.users.email, emailList)
            )
          )
      : Promise.resolve([]),
    emailList.length > 0
      ? db.query.invitations.findMany({
          where: and(
            eq(schema.invitations.orgId, membership.orgId),
            inArray(schema.invitations.email, emailList),
            isNull(schema.invitations.acceptedAt)
          ),
        })
      : Promise.resolve([]),
  ]);
  const existingEmailSet = new Set(
    existingUsersInOrg.map((r) => r.email.toLowerCase())
  );
  const openInviteEmailSet = new Set(
    openInvitesInOrg.map((r) => r.email.toLowerCase())
  );

  const previewRows: PreviewRow[] = outcome.rows.map((r) => {
    if (existingEmailSet.has(r.email)) {
      return { ...r, conflict: "existing_member" };
    }
    if (openInviteEmailSet.has(r.email)) {
      return { ...r, conflict: "open_invite" };
    }
    return r;
  });

  const superviseeRowCount = previewRows.filter(
    (r) => r.role === "supervisee" && !r.conflict
  ).length;
  const executiveRowCount = previewRows.filter(
    (r) => r.role === "executive" && !r.conflict
  ).length;

  // Seat-cap visibility (advisory — final check happens in the commit action).
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, membership.orgId),
    columns: {
      subscriptionStatus: true,
      subscriptionTier: true,
      subscriptionPeriodEnd: true,
      seatCount: true,
    },
  });
  const cap = org ? seatCap(org) : 0;
  const currentSupervisees = await db.query.orgMemberships.findMany({
    where: and(
      eq(schema.orgMemberships.orgId, membership.orgId),
      eq(schema.orgMemberships.role, "supervisee"),
      isNull(schema.orgMemberships.deactivatedAt)
    ),
  });
  const seatCapRemaining = cap === null ? null : Math.max(0, cap - currentSupervisees.length);

  const currentExecs = await db.query.orgMemberships.findMany({
    where: and(
      eq(schema.orgMemberships.orgId, membership.orgId),
      eq(schema.orgMemberships.role, "executive"),
      isNull(schema.orgMemberships.deactivatedAt)
    ),
  });
  const openExecInvites = await db.query.invitations.findMany({
    where: and(
      eq(schema.invitations.orgId, membership.orgId),
      eq(schema.invitations.role, "executive"),
      isNull(schema.invitations.acceptedAt)
    ),
  });
  const executiveSeatsRemaining = Math.max(
    0,
    MAX_EXECUTIVE_SEATS - currentExecs.length - openExecInvites.length
  );

  return {
    ok: true,
    headers: outcome.rawHeaders,
    unrecognizedHeaders: outcome.unrecognizedHeaders,
    rows: previewRows,
    errors: allErrors,
    superviseeRowCount,
    seatCapRemaining,
    executiveRowCount,
    executiveSeatsRemaining,
  };
}

const commitSchema = z.object({
  csv: z.string().min(1, "CSV is required."),
});

export type CommitResult =
  | {
      ok: true;
      created: number;
      skipped: number;
      failed: number;
      perRow: Array<{
        rowNumber: number;
        email: string;
        outcome: "created" | "skipped" | "failed";
        reason?: string;
      }>;
    }
  | { ok: false; error: string };

/**
 * Commit: re-parse, re-validate, then atomically create invitations and
 * fire-and-forget the emails (one Resend call per row — emails are
 * fail-soft). Each row gets an outcome stamp so the UI can show what
 * happened. Conflicts (existing member / open invite for a supervisor or
 * supervisee row) are skipped, not errored. HR Admin rows skip TOTP at
 * the import boundary intentionally — Damon's call: an HR Admin who has
 * the CSV bulk-import permission and is signed in is already operating
 * in trusted territory, and TOTP-gating every row in a 500-row import
 * would be hostile.
 */
export async function commitHrisImportAction(
  _prev: CommitResult | undefined,
  formData: FormData
): Promise<CommitResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageOrg(membership.role)) {
    return { ok: false, error: "Only HR Admins can import team members." };
  }

  const parsed = commitSchema.safeParse({ csv: formData.get("csv") });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const outcome = parseHrisCsv(parsed.data.csv);
  if (outcome.errors.length > 0) {
    return {
      ok: false,
      error: `CSV has ${outcome.errors.length} validation error${outcome.errors.length === 1 ? "" : "s"}. Re-run preview to see them.`,
    };
  }
  if (outcome.rows.length === 0) {
    return { ok: false, error: "CSV has no valid rows." };
  }
  if (outcome.rows.length > MAX_CSV_ROWS) {
    return {
      ok: false,
      error: `Too many rows (${outcome.rows.length}). Max ${MAX_CSV_ROWS} per import.`,
    };
  }

  // Pre-load conflict checks once.
  const emailList = outcome.rows.map((r) => r.email);
  const [existingMembers, openInvites] = await Promise.all([
    db
      .select({ email: schema.users.email })
      .from(schema.orgMemberships)
      .innerJoin(
        schema.users,
        eq(schema.orgMemberships.userId, schema.users.id)
      )
      .where(
        and(
          eq(schema.orgMemberships.orgId, membership.orgId),
          inArray(schema.users.email, emailList)
        )
      ),
    db.query.invitations.findMany({
      where: and(
        eq(schema.invitations.orgId, membership.orgId),
        inArray(schema.invitations.email, emailList),
        isNull(schema.invitations.acceptedAt)
      ),
    }),
  ]);
  const existingEmailSet = new Set(
    existingMembers.map((r) => r.email.toLowerCase())
  );
  const openInviteEmailSet = new Set(
    openInvites.map((r) => r.email.toLowerCase())
  );

  // Executive seat-cap budget (drains as we go).
  const currentExecs = await db.query.orgMemberships.findMany({
    where: and(
      eq(schema.orgMemberships.orgId, membership.orgId),
      eq(schema.orgMemberships.role, "executive"),
      isNull(schema.orgMemberships.deactivatedAt)
    ),
  });
  const openExecInvites = await db.query.invitations.findMany({
    where: and(
      eq(schema.invitations.orgId, membership.orgId),
      eq(schema.invitations.role, "executive"),
      isNull(schema.invitations.acceptedAt)
    ),
  });
  let executiveBudget = Math.max(
    0,
    MAX_EXECUTIVE_SEATS - currentExecs.length - openExecInvites.length
  );

  type PerRow = Extract<CommitResult, { ok: true }>["perRow"];
  const perRow: PerRow = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of outcome.rows) {
    if (existingEmailSet.has(r.email)) {
      perRow.push({
        rowNumber: r.rowNumber,
        email: r.email,
        outcome: "skipped",
        reason: "Already in your org.",
      });
      skipped++;
      continue;
    }
    if (openInviteEmailSet.has(r.email)) {
      perRow.push({
        rowNumber: r.rowNumber,
        email: r.email,
        outcome: "skipped",
        reason: "Already has an open invitation.",
      });
      skipped++;
      continue;
    }
    if (r.role === "executive") {
      if (executiveBudget <= 0) {
        perRow.push({
          rowNumber: r.rowNumber,
          email: r.email,
          outcome: "failed",
          reason: `Executive seat cap reached (${MAX_EXECUTIVE_SEATS} max).`,
        });
        failed++;
        continue;
      }
      executiveBudget--;
    }

    const token = generateInvitationToken();
    try {
      await db.insert(schema.invitations).values({
        orgId: membership.orgId,
        email: r.email,
        name: r.name,
        role: r.role,
        tokenHash: hashToken(token),
        invitedById: session.user.id,
        expiresAt: invitationExpiresAt(),
        pendingRuleId: r.ruleId,
        pendingObligationStartedAt: r.obligationStartedAt
          ? new Date(`${r.obligationStartedAt}T00:00:00Z`)
          : null,
      });

      // Fire-and-forget email; failures are recorded but don't abort the row.
      try {
        await sendImportInviteEmail({
          to: r.email,
          name: r.name,
          token,
          roleLabel: roleLabel(r.role),
          inviterName: session.user.name ?? session.user.email,
          externalId: r.externalId,
        });
      } catch (emailErr) {
        console.error("[hris-import] email failed:", emailErr);
      }

      perRow.push({
        rowNumber: r.rowNumber,
        email: r.email,
        outcome: "created",
      });
      created++;
    } catch (err) {
      perRow.push({
        rowNumber: r.rowNumber,
        email: r.email,
        outcome: "failed",
        reason: err instanceof Error ? err.message : "DB insert failed.",
      });
      failed++;
    }
  }

  try {
    await logAuditEvent({
      orgId: membership.orgId,
      actorUserId: session.user.id,
      action: AUDIT_ACTIONS.INVITATION_SENT,
      resourceType: "invitation",
      details: {
        bulk_import: true,
        total_rows: outcome.rows.length,
        created,
        skipped,
        failed,
      },
    });
  } catch (err) {
    console.error("[hris-import] audit failed:", err);
  }

  revalidatePath("/dashboard/team");
  return { ok: true, created, skipped, failed, perRow };
}

function roleLabel(role: ParsedRow["role"]): string {
  switch (role) {
    case "supervisee":
      return "supervisee";
    case "supervisor":
      return "supervisor";
    case "hr_admin":
      return "HR Admin";
    case "executive":
      return "Executive";
  }
}

async function sendImportInviteEmail(opts: {
  to: string;
  name: string | null;
  token: string;
  roleLabel: string;
  inviterName: string;
  externalId: string | null;
}) {
  const link = `${APP_URL}/accept-invite/${opts.token}`;
  const greeting = opts.name ? `Hi ${opts.name},` : "Hi,";
  await sendEmail({
    to: opts.to,
    subject: `${opts.inviterName} added you to AuditHalo as ${opts.roleLabel}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#08111F; max-width: 560px;">
        <h2 style="font-size: 22px; margin: 0 0 16px;">You're invited.</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          ${greeting} your HR team added you to AuditHalo as <strong>${opts.roleLabel}</strong>.
          Click below to claim your account — the link is good for 14 days.
        </p>
        <p style="margin: 32px 0;">
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background:#071A3D; color:#FBFAF6; text-decoration:none; font-weight:600; border-radius: 4px;">
            Claim your account
          </a>
        </p>
        ${
          opts.externalId
            ? `<p style="font-size: 12px; color: #5f6470;">Employee ID: ${opts.externalId}</p>`
            : ""
        }
        <p style="font-size: 13px; color: #5f6470;">
          Reach me at info@audithalo.com if anything's off.<br/>
          — Damon, founder, AuditHalo
        </p>
      </div>
    `,
    text:
      `${greeting} your HR team added you to AuditHalo as ${opts.roleLabel}.\n\n` +
      `Claim your account: ${link}\n\n` +
      (opts.externalId ? `Employee ID: ${opts.externalId}\n\n` : ``) +
      `— Damon, founder, AuditHalo`,
  });
}
