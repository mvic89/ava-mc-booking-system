-- ─── Agreements table ─────────────────────────────────────────────────────────
-- Stores signed purchase agreements (köpeavtal). Created/updated when both
-- parties sign with BankID on the agreement page.
-- Run once in the Supabase SQL Editor.
-- Safe to re-run: drops and recreates the table.

DROP TABLE IF EXISTS public.agreements CASCADE;

CREATE TABLE public.agreements (
  id                  BIGSERIAL PRIMARY KEY,
  dealership_id       TEXT          NOT NULL,
  lead_id             BIGINT        REFERENCES public.leads(id) ON DELETE CASCADE,
  offer_id            BIGINT        REFERENCES public.offers(id) ON DELETE SET NULL,
  customer_id         BIGINT        REFERENCES public.customers(id) ON DELETE SET NULL,

  agreement_number    TEXT          NOT NULL,
  status              TEXT          NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'signed', 'completed', 'cancelled')),

  -- Customer snapshot (captured at time of signing)
  customer_name       TEXT          NOT NULL DEFAULT '',
  personnummer        TEXT          NOT NULL DEFAULT '',
  customer_address    TEXT          NOT NULL DEFAULT '',
  customer_phone      TEXT          NOT NULL DEFAULT '',
  customer_email      TEXT          NOT NULL DEFAULT '',

  -- Vehicle snapshot
  vehicle             TEXT          NOT NULL DEFAULT '',
  vehicle_color       TEXT          NOT NULL DEFAULT '',
  vehicle_condition   TEXT          NOT NULL DEFAULT 'new',
  vin                 TEXT          NOT NULL DEFAULT '',
  registration_number TEXT          NOT NULL DEFAULT '',

  -- Pricing snapshot
  list_price          NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount            NUMERIC(12,2) NOT NULL DEFAULT 0,
  accessories         TEXT          NOT NULL DEFAULT '',
  accessories_cost    NUMERIC(12,2) NOT NULL DEFAULT 0,
  trade_in            TEXT          NOT NULL DEFAULT '',
  trade_in_credit     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Payment / financing
  payment_type        TEXT          NOT NULL DEFAULT 'cash',
  down_payment        NUMERIC(12,2) NOT NULL DEFAULT 0,
  financing_months    INT           NOT NULL DEFAULT 36,
  financing_monthly   NUMERIC(12,2) NOT NULL DEFAULT 0,
  financing_apr       NUMERIC(5,2)  NOT NULL DEFAULT 4.9,
  nominal_rate        NUMERIC(5,2)  NOT NULL DEFAULT 0,

  -- Delivery
  delivery_weeks      INT           NOT NULL DEFAULT 4,
  valid_until         DATE,
  notes               TEXT          NOT NULL DEFAULT '',

  -- BankID signatures (JSON SigProof objects)
  seller_name         TEXT          NOT NULL DEFAULT '',
  seller_signature    TEXT          NOT NULL DEFAULT '',
  buyer_signature     TEXT          NOT NULL DEFAULT '',
  signed_at           TIMESTAMPTZ,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS agreements_dealership_id_idx ON public.agreements(dealership_id);
CREATE INDEX IF NOT EXISTS agreements_lead_id_idx       ON public.agreements(lead_id);
CREATE INDEX IF NOT EXISTS agreements_offer_id_idx      ON public.agreements(offer_id);
CREATE INDEX IF NOT EXISTS agreements_customer_id_idx   ON public.agreements(customer_id);

-- Unique: one agreement number per dealership
CREATE UNIQUE INDEX IF NOT EXISTS agreements_number_dealer_uniq
  ON public.agreements(agreement_number, dealership_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS agreements_set_updated_at ON public.agreements;
CREATE TRIGGER agreements_set_updated_at
  BEFORE UPDATE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS (service-role key bypasses; browser anon respects)
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agreements_dealership_isolation" ON public.agreements;
CREATE POLICY "agreements_dealership_isolation" ON public.agreements
  FOR ALL USING (dealership_id = current_setting('app.dealership_id', TRUE))
  WITH CHECK  (dealership_id = current_setting('app.dealership_id', TRUE));
