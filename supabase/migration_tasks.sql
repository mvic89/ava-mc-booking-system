-- ─── Tasks & Follow-up System ────────────────────────────────────────────────
-- Stores follow-up tasks per lead/customer.

CREATE TABLE IF NOT EXISTS tasks (
  id            BIGSERIAL PRIMARY KEY,
  dealership_id TEXT        NOT NULL,
  lead_id       BIGINT      REFERENCES leads(id) ON DELETE CASCADE,
  customer_id   BIGINT      REFERENCES customers(id) ON DELETE SET NULL,
  title         TEXT        NOT NULL,
  description   TEXT,
  type          TEXT        NOT NULL DEFAULT 'follow_up',
    -- 'call' | 'email' | 'meeting' | 'follow_up' | 'other'
  priority      TEXT        NOT NULL DEFAULT 'medium',
    -- 'low' | 'medium' | 'high'
  status        TEXT        NOT NULL DEFAULT 'open',
    -- 'open' | 'done' | 'snoozed'
  due_date      TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  assigned_to   TEXT,
  created_by    TEXT,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_dealership_idx ON tasks (dealership_id);
CREATE INDEX IF NOT EXISTS tasks_lead_idx       ON tasks (lead_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx     ON tasks (status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx   ON tasks (due_date);
