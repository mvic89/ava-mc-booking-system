-- ─── Customer Communications Log ─────────────────────────────────────────────
-- Logs every outbound email/SMS sent to customers from within the system.

CREATE TABLE IF NOT EXISTS communications (
  id              BIGSERIAL PRIMARY KEY,
  dealership_id   TEXT        NOT NULL,
  lead_id         BIGINT      REFERENCES leads(id)     ON DELETE SET NULL,
  customer_id     BIGINT      REFERENCES customers(id) ON DELETE SET NULL,
  channel         TEXT        NOT NULL,   -- 'email' | 'sms'
  direction       TEXT        NOT NULL DEFAULT 'outbound',
  subject         TEXT,
  body            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  error_message   TEXT,
  sent_by         TEXT,
  recipient_name  TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  template_id     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comms_dealership_idx ON communications (dealership_id);
CREATE INDEX IF NOT EXISTS comms_lead_idx       ON communications (lead_id);
CREATE INDEX IF NOT EXISTS comms_customer_idx   ON communications (customer_id);
