-- ─── Trade-ins table ──────────────────────────────────────────────────────────
-- Stores motorcycles exchanged as part of a purchase
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.trade_ins (
  id               BIGSERIAL PRIMARY KEY,
  offer_id         BIGINT       REFERENCES public.offers(id) ON DELETE SET NULL,
  lead_id          BIGINT       NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  dealership_id    TEXT         NOT NULL,

  -- Vehicle being traded in
  description      TEXT         NOT NULL DEFAULT '',   -- free-text from offer, e.g. "Honda CB500F 2020, reg ABC123"
  registration_number TEXT      NOT NULL DEFAULT '',
  vin              TEXT         NOT NULL DEFAULT '',
  brand            TEXT         NOT NULL DEFAULT '',
  model            TEXT         NOT NULL DEFAULT '',
  year             INT,
  color            TEXT         NOT NULL DEFAULT '',
  mileage          INT,

  -- Agreed value
  credit_value     NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Status: pending = agreed in offer, completed = vehicle received
  status           TEXT         NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'completed', 'cancelled')),

  notes            TEXT         NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_ins_offer_id_idx      ON public.trade_ins(offer_id);
CREATE INDEX IF NOT EXISTS trade_ins_lead_id_idx       ON public.trade_ins(lead_id);
CREATE INDEX IF NOT EXISTS trade_ins_dealership_id_idx ON public.trade_ins(dealership_id);

DROP TRIGGER IF EXISTS trade_ins_updated_at ON public.trade_ins;
CREATE TRIGGER trade_ins_updated_at
  BEFORE UPDATE ON public.trade_ins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.trade_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trade_ins_dealership_isolation" ON public.trade_ins;
CREATE POLICY "trade_ins_dealership_isolation" ON public.trade_ins
  USING (dealership_id = current_setting('app.dealership_id', TRUE));
