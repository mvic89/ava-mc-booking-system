-- ─── Deliveries table ──────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.deliveries (
  id               BIGSERIAL    PRIMARY KEY,
  dealership_id    TEXT         NOT NULL,
  lead_id          BIGINT       NOT NULL,

  step             TEXT         NOT NULL DEFAULT 'checklist',
  inspection       JSONB        NOT NULL DEFAULT '[]',
  documents        JSONB        NOT NULL DEFAULT '[]',
  walkthrough      JSONB        NOT NULL DEFAULT '[]',

  odometer         TEXT         NOT NULL DEFAULT '',
  fuel_level       TEXT         NOT NULL DEFAULT '',
  damage_notes     TEXT         NOT NULL DEFAULT '',

  customer_name    TEXT         NOT NULL DEFAULT '',
  salesperson      TEXT         NOT NULL DEFAULT '',
  delivery_time    TIMESTAMPTZ,
  customer_signed  BOOLEAN      NOT NULL DEFAULT FALSE,
  dealer_signed    BOOLEAN      NOT NULL DEFAULT FALSE,

  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Unique constraint: one delivery record per lead
ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_lead_id_unique;
ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_lead_id_unique UNIQUE (lead_id);

CREATE INDEX IF NOT EXISTS deliveries_dealership_id_idx ON public.deliveries(dealership_id);
CREATE INDEX IF NOT EXISTS deliveries_lead_id_idx       ON public.deliveries(lead_id);
