-- ─── Fix trade_ins schema ─────────────────────────────────────────────────────
-- The original supabase-schema.sql created trade_ins with an old schema.
-- migration_trade_ins.sql used CREATE TABLE IF NOT EXISTS, so the old table
-- remained. syncTradeIns inserts columns that didn't exist, causing silent
-- console.warn failures. This migration adds the missing columns.
--
-- Run in Supabase SQL Editor.

-- 1. Add missing columns (idempotent — IF NOT EXISTS guards)
ALTER TABLE public.trade_ins
  ADD COLUMN IF NOT EXISTS offer_id            BIGINT,
  ADD COLUMN IF NOT EXISTS dealership_id       TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description         TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS registration_number TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand               TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS model               TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS credit_value        NUMERIC(12,2) NOT NULL DEFAULT 0;

-- 2. Make the old 'name' column nullable so inserts that omit it still work
ALTER TABLE public.trade_ins ALTER COLUMN name DROP NOT NULL;

-- 3. Add indexes for new lookup columns
CREATE INDEX IF NOT EXISTS trade_ins_offer_id_idx      ON public.trade_ins(offer_id);
CREATE INDEX IF NOT EXISTS trade_ins_lead_id_idx       ON public.trade_ins(lead_id);
CREATE INDEX IF NOT EXISTS trade_ins_dealership_id_idx ON public.trade_ins(dealership_id);

-- 4. Enable RLS and create dealership-isolation policy
ALTER TABLE public.trade_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trade_ins_dealership_isolation" ON public.trade_ins;
CREATE POLICY "trade_ins_dealership_isolation" ON public.trade_ins
  USING (dealership_id = current_setting('app.dealership_id', TRUE));
