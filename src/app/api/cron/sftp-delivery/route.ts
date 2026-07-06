/**
 * SFTP delivery queue worker cron.
 *
 * Picks up pending delivery rows from paycor_delivery_queue and
 * pushes the sealed PDFs to Paycor's employee Documents folder
 * via SFTP. Retries up to 3 times; permanently failed deliveries
 * are flagged for HR Admin notification.
 *
 * Schedule: every 5 minutes via GitHub Actions (paused initially).
 * Can also be triggered on-demand after seal via POST.
 *
 * See docs/strategy/14-wave2-phase2-scaffolding.md §Pass 3.
 */

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import {
  processPendingDeliveries,
  MockSftpTransport,
} from "@/lib/hris/sftp-delivery";
import type { SftpTransport } from "@/lib/hris/sftp-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTransport(): SftpTransport {
  // Phase 3: swap for real ssh2-sftp-client transport when
  // Paycor provides SFTP credentials and partner spec.
  return new MockSftpTransport();
}

async function handle(request: Request) {
  const authFail = verifyCronAuth(request);
  if (authFail) return authFail;

  const now = new Date();
  const transport = getTransport();

  const result = await processPendingDeliveries(transport);

  return NextResponse.json({
    ok: result.permanentlyFailed === 0,
    runAt: now.toISOString(),
    ...result,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
