-- Practice hour supervisor approval (strategy doc 21).
-- Supervisees log practice hours, supervisor reviews and approves
-- before they count toward rule evaluation.
ALTER TABLE session_events
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
