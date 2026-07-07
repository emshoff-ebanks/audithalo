-- 0033: Professional credentials on users table.
-- Stores the supervisor's credentials (e.g. ["LCMHCS", "NCC", "LPC"])
-- for auto-population when logging sessions and for assignment validation.
ALTER TABLE users ADD COLUMN credentials jsonb;
