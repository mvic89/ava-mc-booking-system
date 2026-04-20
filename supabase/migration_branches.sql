-- Branches table
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS branches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  address       TEXT,
  city          TEXT,
  phone         TEXT,
  manager_name  TEXT,
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branches_dealership ON branches(dealership_id);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service role full access"
    ON branches FOR ALL
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
