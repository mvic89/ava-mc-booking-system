-- ─── Offers table ────────────────────────────────────────────────────────────
-- Run this in your Supabase SQL editor to enable the offer/quote stage.

CREATE TABLE IF NOT EXISTS public.offers (
  id                   BIGSERIAL PRIMARY KEY,
  lead_id              BIGINT NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  dealership_id        TEXT NOT NULL,
  offer_number         TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),

  -- Customer (mirrored from lead at time of offer creation)
  customer_name        TEXT NOT NULL DEFAULT '',
  personnummer         TEXT NOT NULL DEFAULT '',

  -- Vehicle
  vehicle              TEXT NOT NULL DEFAULT '',
  vin                  TEXT NOT NULL DEFAULT '',
  registration_number  TEXT NOT NULL DEFAULT '',

  -- Pricing
  list_price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount             NUMERIC(12,2) NOT NULL DEFAULT 0,
  accessories          TEXT NOT NULL DEFAULT '',
  accessories_cost     NUMERIC(12,2) NOT NULL DEFAULT 0,
  trade_in             TEXT NOT NULL DEFAULT '',
  trade_in_credit      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price          NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Payment / financing
  payment_type         TEXT NOT NULL DEFAULT 'cash'
                         CHECK (payment_type IN ('cash', 'financing')),
  financing_months     INT          NOT NULL DEFAULT 36,
  financing_monthly    NUMERIC(12,2) NOT NULL DEFAULT 0,
  financing_apr        NUMERIC(5,2)  NOT NULL DEFAULT 4.9,

  -- Meta
  valid_until          DATE,
  notes                TEXT NOT NULL DEFAULT '',

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS offers_lead_id_idx       ON public.offers(lead_id);
CREATE INDEX IF NOT EXISTS offers_dealership_id_idx ON public.offers(dealership_id);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS offers_set_updated_at ON public.offers;
CREATE TRIGGER offers_set_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS (service-role key bypasses this; browser client respects it)
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offers_dealership_isolation" ON public.offers;
CREATE POLICY "offers_dealership_isolation" ON public.offers
  USING (dealership_id = current_setting('app.dealership_id', TRUE));
