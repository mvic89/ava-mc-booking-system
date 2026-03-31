-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add missing profile columns
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. dealerships: add logo_data_url so the signup logo upload persists
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS logo_data_url TEXT;

-- 2. staff_users: store the BankID / Roaring.io identity so it survives sign-out
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS roaring_data  JSONB;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS date_of_birth TEXT;

-- 3. staff_users: status and password_hash (may already exist — safe to re-run)
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'active';
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 4. dealership_settings: email_domain (may already exist — safe to re-run)
ALTER TABLE dealership_settings ADD COLUMN IF NOT EXISTS email_domain TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: ensure anon key can read/write dealerships (needed for prefetchDealerProfile
-- fallback and for saveProfileToSupabase to update the dealerships row)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE dealerships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all — dealerships" ON dealerships;
CREATE POLICY "Allow all — dealerships"
  ON dealerships FOR ALL USING (true) WITH CHECK (true);
