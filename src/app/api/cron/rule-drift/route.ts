import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { db, schema } from "@/lib/db";
import { loadAllRules } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly cron: for every rule under /rules, fetch its citation.url, hash the
 * response body, and upsert a snapshot row. When the new hash differs from
 * what we last stored, mark status="changed" and bump last_changed_at — the
 * /admin/rule-drift page will surface it for human review.
 *
 * This is the v1 of the rule-monitoring moat (project memory:
 * "State rule monitoring system"). For v1 we only watch citation.url; future
 * versions will add full board pages, RSS feeds for state registers, etc.
 */
const CRON_MONITOR_SLUG = "rule-drift";
const CRON_MONITOR_CONFIG = {
  schedule: { type: "crontab" as const, value: "0 13 * * 1" }, // Mondays 13:00 UTC
  checkinMargin: 15,
  maxRuntime: 10,
  timezone: "UTC",
};

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "AuditHaloRuleDriftMonitor/1.0 (+https://audithalo.com)";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkRuleSource(
  ruleId: string,
  url: string,
  prev: typeof schema.ruleSourceSnapshots.$inferSelect | undefined,
  now: Date
): Promise<{ ok: boolean; status: string }> {
  let body = "";
  let httpStatus: number | null = null;
  try {
    const res = await fetchWithTimeout(url);
    httpStatus = res.status;
    if (!res.ok) {
      await db
        .insert(schema.ruleSourceSnapshots)
        .values({
          ruleId,
          url,
          contentHash: prev?.contentHash ?? "",
          status: "error",
          lastCheckedAt: now,
          lastChangedAt: prev?.lastChangedAt ?? now,
          httpStatus,
          errorMessage: `HTTP ${res.status}`,
        })
        .onConflictDoUpdate({
          target: schema.ruleSourceSnapshots.ruleId,
          set: {
            url,
            status: "error",
            lastCheckedAt: now,
            httpStatus,
            errorMessage: `HTTP ${res.status}`,
          },
        });
      return { ok: false, status: "error" };
    }
    body = await res.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    await db
      .insert(schema.ruleSourceSnapshots)
      .values({
        ruleId,
        url,
        contentHash: prev?.contentHash ?? "",
        status: "error",
        lastCheckedAt: now,
        lastChangedAt: prev?.lastChangedAt ?? now,
        httpStatus,
        errorMessage: message,
      })
      .onConflictDoUpdate({
        target: schema.ruleSourceSnapshots.ruleId,
        set: {
          url,
          status: "error",
          lastCheckedAt: now,
          httpStatus,
          errorMessage: message,
        },
      });
    return { ok: false, status: "error" };
  }

  const hash = sha256(body);
  const changed = !!prev && prev.contentHash !== hash;
  const status = !prev ? "ok" : changed ? "changed" : prev.status === "changed" ? "changed" : "ok";

  await db
    .insert(schema.ruleSourceSnapshots)
    .values({
      ruleId,
      url,
      contentHash: hash,
      status,
      lastCheckedAt: now,
      lastChangedAt: changed ? now : prev?.lastChangedAt ?? now,
      httpStatus,
      errorMessage: null,
    })
    .onConflictDoUpdate({
      target: schema.ruleSourceSnapshots.ruleId,
      set: {
        url,
        contentHash: hash,
        status,
        lastCheckedAt: now,
        ...(changed ? { lastChangedAt: now } : {}),
        httpStatus,
        errorMessage: null,
      },
    });

  return { ok: true, status };
}

async function handleRuleDrift(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, reason: "CRON_SECRET not set" },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();
  const rules = [...loadAllRules().values()];
  const result = {
    ok: true,
    runAt: now.toISOString(),
    checked: 0,
    changed: 0,
    errors: 0,
  };

  for (const rule of rules) {
    const ruleId = `${rule.jurisdiction}-${rule.license_code}-v${rule.version}`.toLowerCase();
    const url = rule.citation.url;
    if (!url) continue;

    const prev = await db.query.ruleSourceSnapshots.findFirst({
      where: eq(schema.ruleSourceSnapshots.ruleId, ruleId),
    });

    const outcome = await checkRuleSource(ruleId, url, prev, now);
    result.checked += 1;
    if (outcome.status === "changed") result.changed += 1;
    if (!outcome.ok) result.errors += 1;
  }

  return NextResponse.json(result);
}

export const GET = (request: Request) =>
  Sentry.withMonitor(
    CRON_MONITOR_SLUG,
    () => handleRuleDrift(request),
    CRON_MONITOR_CONFIG
  );
