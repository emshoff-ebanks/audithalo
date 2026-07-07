import { eq, and, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { logAuditEvent, AUDIT_ACTIONS } from "@/lib/audit-log";
import type { PaycorConfig } from "@/lib/db/schema";

const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// SFTP transport interface — mock for dev, real ssh2-sftp-client for prod
// ---------------------------------------------------------------------------

export interface SftpTransport {
  upload(
    config: PaycorConfig,
    remotePath: string,
    data: Buffer,
  ): Promise<void>;
}

export class MockSftpTransport implements SftpTransport {
  public uploads: Array<{ remotePath: string; size: number }> = [];

  async upload(
    _config: PaycorConfig,
    remotePath: string,
    data: Buffer,
  ): Promise<void> {
    this.uploads.push({ remotePath, size: data.length });
  }
}

// ---------------------------------------------------------------------------
// Filename convention
// ---------------------------------------------------------------------------

export function buildDeliveryFilename(
  sessionDate: Date,
  lastName: string,
  firstName: string,
  ruleId: string,
): string {
  const date = sessionDate.toISOString().slice(0, 10);
  const last = sanitizeFilenameSegment(lastName);
  const first = sanitizeFilenameSegment(firstName);
  return `${date}_supervision_${last}_${first}_${ruleId}.pdf`;
}

function sanitizeFilenameSegment(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// ---------------------------------------------------------------------------
// Enqueue — called from evidence.ts post-generation hook
// ---------------------------------------------------------------------------

export async function enqueueDelivery(
  orgId: string,
  evidencePackageId: string,
  paycorEmployeeId: string | null,
): Promise<string> {
  const [row] = await db
    .insert(schema.paycorDeliveryQueue)
    .values({
      orgId,
      evidencePackageId,
      paycorEmployeeId,
      status: "pending",
    })
    .returning({ id: schema.paycorDeliveryQueue.id });

  try {
    await logAuditEvent({
      orgId,
      actorUserId: null,
      action: AUDIT_ACTIONS.PAYCOR_SYNC_DELIVERY_QUEUED,
      resourceType: "evidence_package",
      resourceId: evidencePackageId,
      details: { deliveryId: row.id, paycorEmployeeId },
    });
  } catch {
    /* audit failures must not break the enqueue */
  }

  return row.id;
}

// ---------------------------------------------------------------------------
// Process pending deliveries — called by the cron worker
// ---------------------------------------------------------------------------

export type DeliveryRunResult = {
  processed: number;
  delivered: number;
  failed: number;
  permanentlyFailed: number;
};

export async function processPendingDeliveries(
  transport: SftpTransport,
): Promise<DeliveryRunResult> {
  const pending = await db.query.paycorDeliveryQueue.findMany({
    where: and(
      eq(schema.paycorDeliveryQueue.status, "pending"),
      lt(schema.paycorDeliveryQueue.attempts, MAX_ATTEMPTS),
    ),
  });

  const result: DeliveryRunResult = {
    processed: pending.length,
    delivered: 0,
    failed: 0,
    permanentlyFailed: 0,
  };

  for (const job of pending) {
    try {
      const pkg = await db.query.evidencePackages.findFirst({
        where: eq(schema.evidencePackages.id, job.evidencePackageId),
      });
      if (!pkg) {
        await markFailed(job.id, job.attempts, "Evidence package not found");
        result.failed++;
        continue;
      }

      const org = await db.query.organizations.findFirst({
        where: eq(schema.organizations.id, job.orgId),
      });
      if (!org?.paycorConfig) {
        await markFailed(job.id, job.attempts, "Org has no paycorConfig");
        result.failed++;
        continue;
      }

      const supervisee = await db.query.users.findFirst({
        where: eq(schema.users.id, pkg.superviseeId),
      });

      const session = await db.query.sessionEvents.findFirst({
        where: eq(schema.sessionEvents.id, pkg.sessionEventId),
      });

      const filename = buildDeliveryFilename(
        session?.date ?? new Date(),
        supervisee?.name?.split(" ").pop() ?? "unknown",
        supervisee?.name?.split(" ")[0] ?? "unknown",
        pkg.ruleId,
      );

      const basePath = org.paycorConfig.sftpBasePath ?? "/documents";
      const remotePath = `${basePath}/${filename}`;

      // In production, this would render the PDF and upload via SFTP.
      // For now, the mock transport just records the upload.
      // The PDF content is a placeholder — real rendering uses
      // @react-pdf/renderer which requires a React rendering context.
      const pdfPlaceholder = Buffer.from(
        JSON.stringify(pkg.documentContent),
        "utf-8",
      );

      await transport.upload(org.paycorConfig, remotePath, pdfPlaceholder);

      await db
        .update(schema.paycorDeliveryQueue)
        .set({
          status: "delivered",
          deliveredAt: new Date(),
          attempts: job.attempts + 1,
        })
        .where(eq(schema.paycorDeliveryQueue.id, job.id));

      try {
        await logAuditEvent({
          orgId: job.orgId,
          actorUserId: null,
          action: AUDIT_ACTIONS.PAYCOR_SYNC_DELIVERY_COMPLETED,
          resourceType: "evidence_package",
          resourceId: job.evidencePackageId,
          details: { deliveryId: job.id, remotePath },
        });
      } catch {
        /* audit failures must not break delivery */
      }

      result.delivered++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const newAttempts = job.attempts + 1;
      const isPermanent = newAttempts >= MAX_ATTEMPTS;

      if (isPermanent) {
        await db
          .update(schema.paycorDeliveryQueue)
          .set({
            status: "failed",
            attempts: newAttempts,
            lastError: message,
          })
          .where(eq(schema.paycorDeliveryQueue.id, job.id));

        try {
          await logAuditEvent({
            orgId: job.orgId,
            actorUserId: null,
            action: AUDIT_ACTIONS.PAYCOR_SYNC_DELIVERY_FAILED,
            resourceType: "evidence_package",
            resourceId: job.evidencePackageId,
            details: {
              deliveryId: job.id,
              attempts: newAttempts,
              error: message,
            },
          });
        } catch {
          /* audit failures must not break delivery */
        }

        result.permanentlyFailed++;
      } else {
        await db
          .update(schema.paycorDeliveryQueue)
          .set({
            attempts: newAttempts,
            lastError: message,
          })
          .where(eq(schema.paycorDeliveryQueue.id, job.id));

        result.failed++;
      }
    }
  }

  return result;
}

async function markFailed(
  jobId: string,
  currentAttempts: number,
  error: string,
): Promise<void> {
  const newAttempts = currentAttempts + 1;
  await db
    .update(schema.paycorDeliveryQueue)
    .set({
      status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
      attempts: newAttempts,
      lastError: error,
    })
    .where(eq(schema.paycorDeliveryQueue.id, jobId));
}
