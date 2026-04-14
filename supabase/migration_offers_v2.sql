-- ─── Offer table – additional columns (v2) ───────────────────────────────────
-- Run after migration_offers.sql

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS vehicle_color      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vehicle_condition  TEXT NOT NULL DEFAULT 'new'
                             CHECK (vehicle_condition IN ('new', 'used')),
  ADD COLUMN IF NOT EXISTS down_payment       NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nominal_rate       NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_weeks     INT           NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS customer_address   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_phone     TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_email     TEXT NOT NULL DEFAULT '';
