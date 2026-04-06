-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: notification channels — admin email/phone + Twilio SMS config
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- Admin contact details (who receives notifications for this dealership)
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS admin_email        TEXT;
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS admin_phone        TEXT;   -- e.g. +46701234567

-- Twilio SMS gateway credentials (optional — SMS only sends if all three are set)
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT;
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS twilio_auth_token  TEXT;
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS twilio_from_number TEXT;   -- e.g. +12015551234
