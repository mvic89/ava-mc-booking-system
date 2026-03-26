-- ─── Migration: Add pending_payment to leads stage constraint ────────────────
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- The original constraint only allowed:
--   new | contacted | testride | negotiating | closed | lost
-- This migration adds 'pending_payment' (between negotiating and closed).

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_stage_check;

ALTER TABLE leads ADD CONSTRAINT leads_stage_check
  CHECK (stage IN ('new', 'contacted', 'testride', 'negotiating', 'pending_payment', 'closed', 'lost'));
