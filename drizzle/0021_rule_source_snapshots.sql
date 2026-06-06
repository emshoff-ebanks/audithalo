-- Pre-beta gap §2c: rule-drift monitoring MVP.
--
-- Weekly cron (/api/cron/rule-drift) fetches each rule's citation.url, hashes
-- the response body, and upserts a row here keyed by rule_id. When the new
-- hash differs from what we last recorded, last_changed_at advances and the
-- /admin/rule-drift page surfaces the rule for human review.
--
-- This is the "automated monitoring" leg of the moat described in the state-
-- monitoring memory: catch board pages that move/change before customers
-- report it.
CREATE TABLE IF NOT EXISTS "rule_source_snapshots" (
  "rule_id" text PRIMARY KEY,
  "url" text NOT NULL,
  "content_hash" text NOT NULL,
  "status" text NOT NULL,
  "last_checked_at" timestamp with time zone NOT NULL,
  "last_changed_at" timestamp with time zone NOT NULL,
  "http_status" integer,
  "error_message" text
);
