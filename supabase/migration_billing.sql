-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Stripe billing integration
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / DO block).
-- ─────────────────────────────────────────────────────────────────────────────

-- Stripe Customer ID for this dealership (set when dealership subscribes to BikeMeNow)
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT;

-- Cached subscription info (updated by webhook) — avoids hitting Stripe API on every page load
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT;
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS stripe_plan             TEXT;   -- 'basic' | 'standard' | 'pro'
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS stripe_status           TEXT;   -- 'active' | 'past_due' | 'canceled' etc.
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS stripe_period_end       TIMESTAMPTZ;
