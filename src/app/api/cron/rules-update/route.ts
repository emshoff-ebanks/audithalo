/**
 * Rules-update cron.
 *
 * Weekly job that fetches each canonical rule's `citation.url`, hashes
 * the content (medium-aggressiveness normalization — strips site chrome,
 * keeps regulation text), and compares to the stored `source_hash` from
 * the rule YAML.
 *
 * On content change: writes a `status: 'changed'` row to
 * `rule_source_snapshots`. On fetch error: writes `status: 'error'`.
 * On match: writes `status: 'ok'`.
 *
 * Email notifications are OFF by default — set `RULES_DRIFT_NOTIFY=1`
 * in the environment to enable. This is the activation switch Caleb
 * flips when going live.
 *
 * Schedule lives in `.github/workflows/rules-update.yml` (weekly,
 * paused by default — uncomment the schedule block to enable).
 *
 * See docs/strategy/13-paycor-integration.md §2F.
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { loadAllRules } from "@/lib/rules";
import { fetchAndCompare } from "@/lib/rules/source-fetcher";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const authFail = verifyCronAuth(request);
  if (authFail) return authFail;

  const rules = loadAllRules();
  const now = new Date();
  const notifyEnabled = process.env.RULES_DRIFT_NOTIFY === "1";

  let checked = 0;
  let changed = 0;
  let errored = 0;

  for (const [id, rule] of rules) {
    const url = rule.citation?.url;
    if (!url) continue;

    const expectedHash = rule.verification?.source_hash ?? "";
    const result = await fetchAndCompare(url, expectedHash);

    if (result.ok) {
      checked++;
      const status = result.isChanged ? "changed" : "ok";
      if (result.isChanged) changed++;

      await db
        .insert(schema.ruleSourceSnapshots)
        .values({
          ruleId: id,
          url,
          contentHash: result.contentHash,
          status,
          lastCheckedAt: now,
          lastChangedAt: result.isChanged ? now : now,
          httpStatus: result.httpStatus,
          errorMessage: null,
        })
        .onConflictDoUpdate({
          target: schema.ruleSourceSnapshots.ruleId,
          set: {
            url,
            contentHash: result.contentHash,
            status,
            lastCheckedAt: now,
            ...(result.isChanged ? { lastChangedAt: now } : {}),
            httpStatus: result.httpStatus,
            errorMessage: null,
          },
        });

      if (result.isChanged && notifyEnabled) {
        await notifyDrift(id, url, expectedHash, result.contentHash);
      }
    } else {
      errored++;
      await db
        .insert(schema.ruleSourceSnapshots)
        .values({
          ruleId: id,
          url,
          contentHash: "",
          status: "error",
          lastCheckedAt: now,
          lastChangedAt: now,
          httpStatus: result.httpStatus,
          errorMessage: result.error,
        })
        .onConflictDoUpdate({
          target: schema.ruleSourceSnapshots.ruleId,
          set: {
            url,
            contentHash: "",
            status: "error",
            lastCheckedAt: now,
            httpStatus: result.httpStatus,
            errorMessage: result.error,
          },
        });

      if (notifyEnabled) {
        await notifyBroken(id, url, result.error);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    runAt: now.toISOString(),
    checked,
    changed,
    errored,
    notifyEnabled,
  });
}

async function notifyDrift(
  ruleId: string,
  url: string,
  oldHash: string,
  newHash: string
): Promise<void> {
  try {
    await sendEmail({
      to: process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ?? "info@audithalo.com",
      subject: `[AuditHalo] Rule source changed: ${ruleId}`,
      text: `The citation URL for rule ${ruleId} has new content.\n\nURL: ${url}\nOld hash: ${oldHash}\nNew hash: ${newHash}\n\nReview the new content and update the rule YAML if warranted.`,
      html: `<p>The citation URL for rule <strong>${ruleId}</strong> has new content.</p><p>URL: <a href="${url}">${url}</a></p><p>Old hash: <code>${oldHash}</code><br/>New hash: <code>${newHash}</code></p><p>Review the new content and update the rule YAML if warranted.</p>`,
    });
  } catch (err) {
    console.error("[rules-update] drift notification failed:", err);
  }
}

async function notifyBroken(
  ruleId: string,
  url: string,
  error: string
): Promise<void> {
  try {
    await sendEmail({
      to: process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ?? "info@audithalo.com",
      subject: `[AuditHalo] Rule source URL broken: ${ruleId}`,
      text: `The citation URL for rule ${ruleId} is unreachable.\n\nURL: ${url}\nError: ${error}\n\nUpdate the citation URL in the rule YAML.`,
      html: `<p>The citation URL for rule <strong>${ruleId}</strong> is unreachable.</p><p>URL: <a href="${url}">${url}</a></p><p>Error: <code>${error}</code></p><p>Update the citation URL in the rule YAML.</p>`,
    });
  } catch (err) {
    console.error("[rules-update] broken-url notification failed:", err);
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
