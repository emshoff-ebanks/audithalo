-- 0032: Add paycor_employee_id to org_memberships for Paycor sync matching.
-- Enables matching synced employees by their Paycor ID instead of email alone.
ALTER TABLE org_memberships ADD COLUMN paycor_employee_id text;
CREATE INDEX idx_org_memberships_paycor_eid
  ON org_memberships (paycor_employee_id)
  WHERE paycor_employee_id IS NOT NULL;
