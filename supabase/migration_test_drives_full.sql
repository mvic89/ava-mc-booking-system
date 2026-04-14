-- ─── Run this in Supabase SQL Editor ─────────────────────────────────────────
-- Creates the test_drives table (including insurance + BankID signature columns)

CREATE TABLE IF NOT EXISTS public.test_drives (
  id                    BIGSERIAL PRIMARY KEY,
  lead_id               BIGINT        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  dealership_id         TEXT          NOT NULL,

  -- Customer snapshot
  customer_name         TEXT          NOT NULL DEFAULT '',
  personnummer          TEXT          NOT NULL DEFAULT '',
  customer_address      TEXT          NOT NULL DEFAULT '',
  customer_phone        TEXT          NOT NULL DEFAULT '',
  customer_email        TEXT          NOT NULL DEFAULT '',
  license_number        TEXT          NOT NULL DEFAULT '',
  license_class         TEXT          NOT NULL DEFAULT 'A',

  -- Vehicle
  vehicle               TEXT          NOT NULL DEFAULT '',
  vin                   TEXT          NOT NULL DEFAULT '',
  registration_number   TEXT          NOT NULL DEFAULT '',
  vehicle_color         TEXT          NOT NULL DEFAULT '',
  odometer_before       INT           NOT NULL DEFAULT 0,
  odometer_after        INT,

  -- Schedule
  scheduled_date        DATE,
  departure_time        TIME,
  return_time           TIME,
  route                 TEXT          NOT NULL DEFAULT '',

  -- Insurance & inspection
  insurance_company     TEXT          NOT NULL DEFAULT '',
  insurance_fee         NUMERIC(10,2) NOT NULL DEFAULT 0,
  pre_inspection_ok     BOOLEAN       NOT NULL DEFAULT true,
  pre_inspection_notes  TEXT          NOT NULL DEFAULT '',
  post_inspection_notes TEXT          NOT NULL DEFAULT '',

  -- Staff
  staff_name            TEXT          NOT NULL DEFAULT '',

  -- BankID signature proofs (JSON: { name, personalNumber, signedAt, verified })
  driver_signature      TEXT          NOT NULL DEFAULT '',
  staff_signature       TEXT          NOT NULL DEFAULT '',

  -- Status
  status                TEXT          NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled','ongoing','completed','cancelled')),

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS test_drives_lead_id_idx       ON public.test_drives(lead_id);
CREATE INDEX IF NOT EXISTS test_drives_dealership_id_idx ON public.test_drives(dealership_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS test_drives_updated_at ON public.test_drives;
CREATE TRIGGER test_drives_updated_at
  BEFORE UPDATE ON public.test_drives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.test_drives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.test_drives;
CREATE POLICY "tenant_isolation" ON public.test_drives
  USING (dealership_id = current_setting('app.dealership_id', true));

-- If the table already exists (from the earlier migration) just add missing columns
ALTER TABLE public.test_drives
  ADD COLUMN IF NOT EXISTS insurance_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_signature TEXT          NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS staff_signature  TEXT          NOT NULL DEFAULT '';
