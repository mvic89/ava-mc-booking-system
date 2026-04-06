-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add nps_score column to customers table
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE customers ADD COLUMN IF NOT EXISTS nps_score NUMERIC(4,1);
