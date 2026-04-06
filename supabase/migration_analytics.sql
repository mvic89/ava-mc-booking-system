-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: analytics columns
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / IF EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- Track which salesperson owns each lead (for leaderboard)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS salesperson_name TEXT;

-- Track when a lead was closed (stage → 'closed') for inventory turnover
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
