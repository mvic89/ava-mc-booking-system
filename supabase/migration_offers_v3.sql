-- ─── Offers v3 — add BankID signature columns ────────────────────────────────
-- Run in Supabase SQL Editor

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS seller_signature TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS buyer_signature  TEXT NOT NULL DEFAULT '';
