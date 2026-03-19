-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add dealership_id to all tables + fix vendors structure
-- Run this in the Supabase SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / DO $$ blocks).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. dealerships table (if not already created) ─────────────────────────────
CREATE TABLE IF NOT EXISTS dealerships (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL,
    email         TEXT,
    phone         TEXT,
    address       TEXT,
    org_nr        TEXT,
    postal_code   TEXT,
    city          TEXT,
    website       TEXT,
    plan          TEXT,
    smtp_user     TEXT,
    smtp_pass     TEXT,
    smtp_host     TEXT        DEFAULT 'smtp.gmail.com',
    smtp_port     INTEGER     DEFAULT 587,
    zapier_token  TEXT        UNIQUE DEFAULT gen_random_uuid()::text,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add any missing columns if dealerships was already created without them
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS org_nr       TEXT;
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS postal_code  TEXT;
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS city         TEXT;
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS website      TEXT;
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS plan         TEXT;
ALTER TABLE dealerships ADD COLUMN IF NOT EXISTS zapier_token TEXT UNIQUE DEFAULT gen_random_uuid()::text;

ALTER TABLE dealerships ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'dealerships' AND policyname = 'allow all'
    ) THEN
        CREATE POLICY "allow all" ON dealerships FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ── 2. Add dealership_id to motorcycles ──────────────────────────────────────
ALTER TABLE motorcycles ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE;

-- ── 3. Add dealership_id to spare_parts ──────────────────────────────────────
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE;

-- ── 4. Add dealership_id to accessories ──────────────────────────────────────
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE;

-- ── 5. Add dealership_id to purchase_orders ──────────────────────────────────
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE;

-- ── 6. Fix vendors table ──────────────────────────────────────────────────────
-- vendors already has id BIGSERIAL. We just add the missing columns and
-- restore a primary key if the old name-based one was dropped.

-- Restore primary key on id if no PK exists (covers the case where vendors_pkey was dropped)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'vendors'::regclass AND contype = 'p'
    ) THEN
        ALTER TABLE vendors ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Add missing columns
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS dealership_id    UUID    REFERENCES dealerships(id) ON DELETE CASCADE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_manual        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS supplier_number  TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS categories       TEXT[]  DEFAULT '{}';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS email            TEXT;

-- Add unique constraint on (name, dealership_id) for upsert conflict target
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'vendors'::regclass
          AND conname = 'vendors_name_dealership_id_key'
    ) THEN
        ALTER TABLE vendors ADD CONSTRAINT vendors_name_dealership_id_key UNIQUE (name, dealership_id);
    END IF;
END $$;

-- ── 7. Indexes for performance ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS motorcycles_dealership_idx     ON motorcycles(dealership_id);
CREATE INDEX IF NOT EXISTS spare_parts_dealership_idx     ON spare_parts(dealership_id);
CREATE INDEX IF NOT EXISTS accessories_dealership_idx     ON accessories(dealership_id);
CREATE INDEX IF NOT EXISTS purchase_orders_dealership_idx ON purchase_orders(dealership_id);
CREATE INDEX IF NOT EXISTS vendors_dealership_idx         ON vendors(dealership_id);

-- ── 8. staff_users table (if not already created) ────────────────────────────
CREATE TABLE IF NOT EXISTS staff_users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id   UUID        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    email           TEXT        NOT NULL UNIQUE,
    role            TEXT        NOT NULL DEFAULT 'sales' CHECK (role IN ('admin','sales','service')),
    personal_number TEXT,
    bankid_verified BOOLEAN     NOT NULL DEFAULT false,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'staff_users' AND policyname = 'allow all'
    ) THEN
        CREATE POLICY "allow all" ON staff_users FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- After running this migration:
--
-- 1. Go to your dealership row in the dealerships table and copy its UUID.
-- 2. Open the Supabase Table Editor → seed any existing motorcycles/spare_parts/
--    accessories rows with that UUID in the dealership_id column.
--    (Or just delete the old test rows and re-add them from the app.)
-- ─────────────────────────────────────────────────────────────────────────────
