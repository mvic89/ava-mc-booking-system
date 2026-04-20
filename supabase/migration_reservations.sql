-- ─── Vehicle Reservations table ───────────────────────────────────────────────
-- Track vehicle reservations / deposits linked to leads
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.reservations (
  id               BIGSERIAL    PRIMARY KEY,
  dealership_id    TEXT         NOT NULL,
  lead_id          BIGINT       NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  customer_id      BIGINT       REFERENCES public.customers(id) ON DELETE SET NULL,

  -- What is being reserved
  vehicle_name     TEXT         NOT NULL DEFAULT '',
  vin              TEXT         NOT NULL DEFAULT '',
  stock_number     TEXT         NOT NULL DEFAULT '',

  -- Deposit
  deposit_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_paid     BOOLEAN      NOT NULL DEFAULT FALSE,
  deposit_paid_at  TIMESTAMPTZ,
  payment_method   TEXT         NOT NULL DEFAULT '',   -- e.g. "Swish", "Kort", "Kontant"
  payment_ref      TEXT         NOT NULL DEFAULT '',

  -- Reservation window
  reserved_until   TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  -- Status
  status           TEXT         NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'converted', 'expired', 'cancelled', 'refunded')),

  -- Who reserved
  reserved_by      TEXT         NOT NULL DEFAULT '',   -- salesperson name
  customer_name    TEXT         NOT NULL DEFAULT '',
  customer_email   TEXT         NOT NULL DEFAULT '',
  customer_phone   TEXT         NOT NULL DEFAULT '',

  notes            TEXT         NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reservations_dealership_id_idx ON public.reservations(dealership_id);
CREATE INDEX IF NOT EXISTS reservations_lead_id_idx       ON public.reservations(lead_id);
CREATE INDEX IF NOT EXISTS reservations_status_idx        ON public.reservations(status);
CREATE INDEX IF NOT EXISTS reservations_reserved_until_idx ON public.reservations(reserved_until);

DROP TRIGGER IF EXISTS reservations_updated_at ON public.reservations;
CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservations_dealership_isolation" ON public.reservations;
CREATE POLICY "reservations_dealership_isolation" ON public.reservations
  USING (dealership_id = current_setting('app.dealership_id', TRUE));
