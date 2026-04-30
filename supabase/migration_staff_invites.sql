-- ── Staff Invites ─────────────────────────────────────────────────────────────
-- Stores pending staff invitations server-side so any device can look them up.
-- Previously tokens were held in the admin's localStorage, which broke cross-
-- device invite flows.

CREATE TABLE IF NOT EXISTS staff_invites (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  token           UUID          UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  email           TEXT          NOT NULL,
  name            TEXT          NOT NULL,
  role            TEXT          NOT NULL,
  dealership_id   UUID          REFERENCES dealerships(id) ON DELETE CASCADE,
  dealership_name TEXT,
  invited_by      TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  expires_at      TIMESTAMPTZ   NOT NULL,
  accepted        BOOLEAN       DEFAULT false,
  accepted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_token       ON staff_invites(token);
CREATE INDEX IF NOT EXISTS idx_staff_invites_dealership  ON staff_invites(dealership_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_email       ON staff_invites(email);

ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_invites' AND policyname = 'allow_all'
  ) THEN
    CREATE POLICY allow_all ON staff_invites FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Backfill: add columns that may be missing if the table was created from an earlier version
ALTER TABLE staff_invites ADD COLUMN IF NOT EXISTS invited_by     TEXT;
ALTER TABLE staff_invites ADD COLUMN IF NOT EXISTS accepted_at    TIMESTAMPTZ;
ALTER TABLE staff_invites ADD COLUMN IF NOT EXISTS dealership_name TEXT;

-- Fix role check constraint to include all valid roles
ALTER TABLE staff_invites DROP CONSTRAINT IF EXISTS staff_invites_role_check;
ALTER TABLE staff_invites ADD CONSTRAINT staff_invites_role_check
  CHECK (role IN ('admin', 'sales', 'service', 'sales_manager', 'accountant', 'technician', 'platform_admin'));

-- Fix staff_users role check constraint (original only had admin/sales/service)
ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_users_role_check;
ALTER TABLE staff_users ADD CONSTRAINT staff_users_role_check
  CHECK (role IN ('admin', 'sales', 'service', 'sales_manager', 'accountant', 'technician', 'platform_admin'));
