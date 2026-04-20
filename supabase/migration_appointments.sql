-- ─── Appointments / Calendar ─────────────────────────────────────────────────
-- Stores booked appointments: test drives, meetings, deliveries, viewings.

CREATE TABLE IF NOT EXISTS appointments (
  id              BIGSERIAL PRIMARY KEY,
  dealership_id   TEXT        NOT NULL,
  lead_id         BIGINT      REFERENCES leads(id)     ON DELETE SET NULL,
  customer_id     BIGINT      REFERENCES customers(id) ON DELETE SET NULL,
  type            TEXT        NOT NULL DEFAULT 'test_drive',
    -- 'test_drive' | 'meeting' | 'delivery' | 'viewing'
  title           TEXT,
  notes           TEXT,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  staff_name      TEXT,
  customer_name   TEXT,
  bike_name       TEXT,
  status          TEXT        NOT NULL DEFAULT 'scheduled',
    -- 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appt_dealership_idx  ON appointments (dealership_id);
CREATE INDEX IF NOT EXISTS appt_lead_idx        ON appointments (lead_id);
CREATE INDEX IF NOT EXISTS appt_start_time_idx  ON appointments (start_time);
