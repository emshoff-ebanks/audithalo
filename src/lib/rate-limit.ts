import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Sliding-window rate limiter backed by the rate_limit_attempts table.
 * Returns { allowed: true } if under the limit, or { allowed: false }
 * with a retry-after hint if the window is exhausted.
 *
 * The key is typically an email address (for login/reset) or an IP
 * (for signup). The action discriminates between different rate limits
 * so login and signup don't share a counter.
 */
export async function checkRateLimit(
  key: string,
  action: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000);

  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM rate_limit_attempts
    WHERE key = ${key.toLowerCase()}
      AND action = ${action}
      AND attempted_at > ${windowStart.toISOString()}::timestamptz
  `);

  const count =
    (result as unknown as { rows: { count: number }[] }).rows[0]?.count ?? 0;

  if (count >= maxAttempts) {
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }

  await db.execute(sql`
    INSERT INTO rate_limit_attempts (id, key, action, attempted_at)
    VALUES (gen_random_uuid(), ${key.toLowerCase()}, ${action}, NOW())
  `);

  return { allowed: true };
}

export const RATE_LIMITS = {
  login: { maxAttempts: 5, windowSeconds: 900 },
  signup: { maxAttempts: 3, windowSeconds: 900 },
  passwordReset: { maxAttempts: 3, windowSeconds: 3600 },
  invitationResend: { maxAttempts: 3, windowSeconds: 3600 },
} as const;
