import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Constant-time verification of the cron `Authorization: Bearer <CRON_SECRET>`
 * header. Use at the top of every cron route handler — a plain `===` compare
 * leaks the secret bytewise to anyone who can time the response, and the
 * 10-minute sign-reminder cron gives an off-path observer abundant samples.
 *
 * Returns:
 *   - a 500 NextResponse if `CRON_SECRET` isn't set in the environment
 *   - a 401 NextResponse if the header is missing or doesn't match
 *   - `null` if the request passes (caller continues normally)
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, reason: "CRON_SECRET not set — refusing to run" },
      { status: 500 }
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  let ok: boolean;
  if (a.length !== b.length) {
    // Spend the same time we would have spent on a real compare so an
    // attacker can't distinguish "wrong length" from "wrong content".
    timingSafeEqual(b, b);
    ok = false;
  } else {
    ok = timingSafeEqual(a, b);
  }
  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return null;
}
