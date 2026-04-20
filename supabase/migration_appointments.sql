-- Appointments / Calendar table
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS appointments (
  id            BIGSERIAL   PRIMARY KEY,
  dealership_id TEXT        NOT NULL,
  lead_id       BIGINT      REFERENCES leads(id)     ON DELETE SET NULL,
  customer_id   BIGINT      REFERENCES customers(id) ON DELETE SET NULL,
  type          TEXT        NOT NULL DEFAULT 'test_drive'
                            CHECK (type IN ('test_drive','meeting','delivery','viewing')),
  title         TEXT,
  notes         TEXT,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  staff_name    TEXT,
  customer_name TEXT,
  bike_name     TEXT,
  status        TEXT        NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled','confirmed','cancelled','completed')),
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_dealership  ON appointments(dealership_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time  ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_lead        ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer    ON appointments(customer_id);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service role full access"
    ON appointments FOR ALL
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
