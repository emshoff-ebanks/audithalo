-- Cycle 2 / NIM-4: Founding Supervisor badge.
--
-- Flagged via admin action after Damon manually approves a Founding
-- Supervisor application from /founding. The badge gets a small visual
-- treatment in the dashboard header and is reserved for future
-- "early-access feature" branches (no actual features wired in v1).
--
-- Default false so existing rows stay untouched.
ALTER TABLE "users"
  ADD COLUMN "is_founding_supervisor" boolean NOT NULL DEFAULT false;
