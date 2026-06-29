/**
 * Pure helper for the rules-update cron. Fetches a rule's citation URL,
 * strips HTML to text, hashes the result, and compares to the stored
 * source_hash from the rule YAML.
 *
 * Medium-aggressiveness normalization: strips <script>, <style>, <nav>,
 * <header>, <footer>, HTML comments, all tags, and normalizes
 * whitespace. This catches real regulatory content changes while
 * ignoring site-chrome reskins. Calibrate after observing false-positive
 * rate over a few weeks of live cron runs.
 */

import { createHash } from "node:crypto";

const USER_AGENT =
  "AuditHalo-Rule-Monitor/1.0 (mailto:info@audithalo.com)";
const FETCH_TIMEOUT_MS = 30_000;

export type FetchResult =
  | {
      ok: true;
      contentHash: string;
      httpStatus: number;
      isChanged: boolean;
    }
  | {
      ok: false;
      httpStatus: number | null;
      error: string;
    };

/**
 * Fetch a rule's citation URL and compare the content hash to the
 * expected hash from the YAML's `verification.source_hash`.
 */
export async function fetchAndCompare(
  url: string,
  expectedHash: string
): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (err) {
    return {
      ok: false,
      httpStatus: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status,
      error: `HTTP ${res.status} ${res.statusText}`,
    };
  }

  const html = await res.text();
  const normalized = normalizeHtml(html);
  const contentHash = sha256(normalized);

  return {
    ok: true,
    contentHash,
    httpStatus: res.status,
    isChanged: contentHash !== expectedHash,
  };
}

/**
 * Medium-aggressiveness HTML normalization.
 *
 * Strips structural elements that change with site redesigns, then
 * extracts text content only. The goal is for a hash of the result
 * to remain stable when the board reskins their nav but change when
 * the regulation text itself is edited.
 */
export function normalizeHtml(html: string): string {
  let text = html;

  // Strip entire blocks we don't care about.
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<header[\s\S]*?<\/header>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");

  // Strip all remaining HTML tags.
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities.
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Normalize whitespace: collapse runs + trim.
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
