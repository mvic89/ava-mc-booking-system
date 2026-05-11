-- Transportstyrelsen ownership transfer tracking
-- Run in Supabase SQL Editor

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS transfer_case_id      TEXT,
  ADD COLUMN IF NOT EXISTS transfer_status       TEXT,
  ADD COLUMN IF NOT EXISTS transfer_completed_at TIMESTAMPTZ;

-- Also add the column that the work orders migration required
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_transfer_case_id ON leads (transfer_case_id)
  WHERE transfer_case_id IS NOT NULL;
