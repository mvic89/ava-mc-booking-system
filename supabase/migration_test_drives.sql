-- ─── Test drives table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.test_drives (
  id                      BIGSERIAL PRIMARY KEY,
  lead_id                 BIGINT NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  dealership_id           TEXT NOT NULL,

  -- Customer snapshot
  customer_name           TEXT NOT NULL DEFAULT '',
  personnummer            TEXT NOT NULL DEFAULT '',
  customer_address        TEXT NOT NULL DEFAULT '',
  customer_phone          TEXT NOT NULL DEFAULT '',
  customer_email          TEXT NOT NULL DEFAULT '',
  license_number          TEXT NOT NULL DEFAULT '',
  license_class           TEXT NOT NULL DEFAULT 'A'
                            CHECK (license_class IN ('A', 'A1', 'A2', 'AM', 'B')),

  -- Vehicle
  vehicle                 TEXT NOT NULL DEFAULT '',
  vin                     TEXT NOT NULL DEFAULT '',
  registration_number     TEXT NOT NULL DEFAULT '',
  vehicle_color           TEXT NOT NULL DEFAULT '',
  odometer_before         INT  NOT NULL DEFAULT 0,
  odometer_after          INT,

  -- Schedule
  scheduled_date          DATE,
  departure_time          TIME,
  return_time             TIME,
  route                   TEXT NOT NULL DEFAULT '',

  -- Insurance
  insurance_company       TEXT NOT NULL DEFAULT '',

  -- Inspection
  pre_inspection_ok       BOOLEAN NOT NULL DEFAULT TRUE,
  pre_inspection_notes    TEXT NOT NULL DEFAULT '',
  post_inspection_notes   TEXT NOT NULL DEFAULT '',

  -- Staff
  staff_name              TEXT NOT NULL DEFAULT '',

  -- Status
  status                  TEXT NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS test_drives_lead_id_idx        ON public.test_drives(lead_id);
CREATE INDEX IF NOT EXISTS test_drives_dealership_id_idx  ON public.test_drives(dealership_id);

DROP TRIGGER IF EXISTS test_drives_set_updated_at ON public.test_drives;
CREATE TRIGGER test_drives_set_updated_at
  BEFORE UPDATE ON public.test_drives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.test_drives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_drives_dealership_isolation" ON public.test_drives;
CREATE POLICY "test_drives_dealership_isolation" ON public.test_drives
  USING (dealership_id = current_setting('app.dealership_id', TRUE));
