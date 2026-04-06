-- ============================================================
-- Operations & Admin features migration
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Granular roles ──────────────────────────────────────
ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_users_role_check;
ALTER TABLE staff_users ADD CONSTRAINT staff_users_role_check
  CHECK (role IN ('admin','sales','service','sales_manager','accountant','technician'));

-- ── 2. Branches / multi-location ──────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  address       TEXT,
  city          TEXT,
  phone         TEXT,
  manager_name  TEXT,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_branches_dealer ON branches(dealership_id);

-- Link staff to a branch (optional)
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Link leads to a branch (optional)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- ── 3. Documents ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  lead_id       BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  customer_id   BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  file_size     BIGINT DEFAULT 0,
  mime_type     TEXT DEFAULT 'application/pdf',
  category      TEXT DEFAULT 'other'
                CHECK (category IN ('agreement','insurance','registration','invoice','other')),
  uploaded_by   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_dealer   ON documents(dealership_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead     ON documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- ── 4. Staff performance targets ──────────────────────────
CREATE TABLE IF NOT EXISTS staff_targets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id  UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  staff_email    TEXT NOT NULL,
  staff_name     TEXT NOT NULL,
  period_year    INT NOT NULL,
  period_month   INT NOT NULL DEFAULT 0,  -- 0 = annual target
  leads_target   INT DEFAULT 0,
  revenue_target NUMERIC(12,2) DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dealership_id, staff_email, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_targets_dealer ON staff_targets(dealership_id);

-- Enable realtime on new tables
ALTER TABLE branches       REPLICA IDENTITY FULL;
ALTER TABLE documents      REPLICA IDENTITY FULL;
ALTER TABLE staff_targets  REPLICA IDENTITY FULL;
