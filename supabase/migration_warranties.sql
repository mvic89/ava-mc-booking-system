-- ─── Warranties table ─────────────────────────────────────────────────────────
-- Track warranty coverage per sold vehicle
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.warranties (
  id               BIGSERIAL    PRIMARY KEY,
  dealership_id    TEXT         NOT NULL,
  lead_id          BIGINT       REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id      BIGINT       REFERENCES public.customers(id) ON DELETE SET NULL,

  -- Vehicle
  vehicle_name     TEXT         NOT NULL DEFAULT '',
  vin              TEXT         NOT NULL DEFAULT '',
  registration_nr  TEXT         NOT NULL DEFAULT '',

  -- Warranty details
  type             TEXT         NOT NULL DEFAULT 'standard'
                     CHECK (type IN ('standard', 'extended', 'manufacturer', 'third_party')),
  provider         TEXT         NOT NULL DEFAULT '',   -- e.g. "Yamaha Motor", "Gjensidige"
  policy_number    TEXT         NOT NULL DEFAULT '',

  -- Coverage period
  start_date       DATE         NOT NULL,
  end_date         DATE         NOT NULL,

  -- Coverage amount (max claim)
  coverage_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Status
  status           TEXT         NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'expired', 'claimed', 'cancelled', 'voided')),

  -- Claim tracking
  claim_date       DATE,
  claim_amount     NUMERIC(12,2),
  claim_notes      TEXT,

  notes            TEXT         NOT NULL DEFAULT '',
  created_by       TEXT         NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS warranties_dealership_id_idx ON public.warranties(dealership_id);
CREATE INDEX IF NOT EXISTS warranties_lead_id_idx       ON public.warranties(lead_id);
CREATE INDEX IF NOT EXISTS warranties_customer_id_idx   ON public.warranties(customer_id);
CREATE INDEX IF NOT EXISTS warranties_status_idx        ON public.warranties(status);
CREATE INDEX IF NOT EXISTS warranties_end_date_idx      ON public.warranties(end_date);

DROP TRIGGER IF EXISTS warranties_updated_at ON public.warranties;
CREATE TRIGGER warranties_updated_at
  BEFORE UPDATE ON public.warranties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warranties_dealership_isolation" ON public.warranties;
CREATE POLICY "warranties_dealership_isolation" ON public.warranties
  USING (dealership_id = current_setting('app.dealership_id', TRUE));
