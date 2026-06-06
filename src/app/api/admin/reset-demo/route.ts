import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/authz";
import { runDemoSeed } from "@/lib/demo/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/reset-demo
 *
 * Resets the demo org back to its idempotent baseline. Gated to admins
 * (ADMIN_EMAILS env var). Used to keep the demo clean for prospects after
 * earlier visitors have poked around.
 *
 * The seed runs synchronously inside the request (~3s typical). Returns 404
 * on non-admin to avoid leaking the endpoint's existence to scanners.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  try {
    const { supervisorId } = await runDemoSeed();
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      supervisorId,
    });
  } catch (err) {
    console.error("[admin/reset-demo] seed failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "seed failed" },
      { status: 500 }
    );
  }
}
