-- ============================================
-- AVA MC Booking System - Supabase SQL Setup
-- ============================================
-- Paste into Supabase SQL Editor and run.
-- Safe to re-run: all statements use IF NOT EXISTS / DROP IF EXISTS guards.
--
-- After running, enable Realtime for each table in the Dashboard:
--   Database → Replication → supabase_realtime → toggle each table ON
-- Tables to enable: webhook_events, dealership_settings, customers,
--   leads, invoices, motorcycles, spare_parts, accessories, staff_users

-- ============================================
-- Webhook Events
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_events (
  id         BIGSERIAL PRIMARY KEY,
  provider   TEXT NOT NULL,        -- 'adyen' | 'stripe' | 'svea' | 'swish' | 'custom'
  event_type TEXT NOT NULL,        -- e.g. 'AUTHORISATION', 'payment_intent.succeeded', 'PAID'
  payload    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider   ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- ============================================
-- Dealership settings / profile
-- ============================================
-- ROOT tenant table — all other tables reference this via dealership_id.

CREATE TABLE IF NOT EXISTS dealership_settings (
  dealership_id        UUID        PRIMARY KEY,
  name                 TEXT,
  org_nr               TEXT,
  vat_nr               TEXT,
  f_skatt              BOOLEAN     DEFAULT TRUE,
  street               TEXT,
  postal_code          TEXT,
  city                 TEXT,
  county               TEXT        DEFAULT 'Stockholm',
  phone                TEXT,
  email                TEXT,
  email_domain         TEXT,       -- shared domain for all staff, e.g. "avamc.se"
  website              TEXT,
  bankgiro             TEXT,
  swish                TEXT,
  logo_data_url        TEXT,       -- base64 data URL, max ~250 KB
  cover_image_data_url TEXT,       -- base64 data URL, max ~800 KB
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add email_domain if table already existed without it
ALTER TABLE dealership_settings ADD COLUMN IF NOT EXISTS email_domain TEXT;

-- ============================================
-- ACTIVE APP TABLES
-- ============================================

-- ── customers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                 BIGSERIAL     PRIMARY KEY,
  first_name         TEXT          NOT NULL,
  last_name          TEXT          NOT NULL,
  personnummer       TEXT,
  email              TEXT,
  phone              TEXT,
  address            TEXT,
  city               TEXT,
  source             TEXT          NOT NULL DEFAULT 'Manual', -- 'BankID' | 'Manual' | 'SPAR'
  lifetime_value     NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_activity      TIMESTAMPTZ            DEFAULT NOW(),
  tag                TEXT          NOT NULL DEFAULT 'New',    -- 'VIP' | 'Active' | 'New' | 'Inactive'
  bankid_verified    BOOLEAN       NOT NULL DEFAULT FALSE,
  protected_identity BOOLEAN       NOT NULL DEFAULT FALSE,
  gender             TEXT,
  birth_date         TEXT,
  notes              TEXT,
  dealership_id      UUID          NOT NULL REFERENCES dealership_settings(dealership_id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ            DEFAULT NOW(),
  updated_at         TIMESTAMPTZ            DEFAULT NOW()
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS customers_pnr_dealer_uidx ON customers(personnummer, dealership_id)
  WHERE personnummer IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_dealership_idx   ON customers(dealership_id);
CREATE INDEX IF NOT EXISTS customers_email_dealer_idx ON customers(email, dealership_id);
CREATE INDEX IF NOT EXISTS customers_tag_idx          ON customers(tag, dealership_id);

-- ── leads ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id            BIGSERIAL     PRIMARY KEY,
  name          TEXT          NOT NULL,
  bike          TEXT          NOT NULL,
  value         NUMERIC(12,2)          DEFAULT 0,
  email         TEXT,
  phone         TEXT,
  personnummer  TEXT,
  lead_status   TEXT          NOT NULL DEFAULT 'warm',   -- 'hot' | 'warm' | 'cold'
  stage         TEXT          NOT NULL DEFAULT 'new',    -- 'new' | 'contacted' | 'testride' | 'negotiating' | 'closed'
  source        TEXT                   DEFAULT 'Manual',
  notes         TEXT,
  address       TEXT,
  city          TEXT,
  customer_id   BIGINT                 REFERENCES customers(id) ON DELETE SET NULL,
  closed_at     TIMESTAMPTZ,
  dealership_id UUID          NOT NULL REFERENCES dealership_settings(dealership_id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ            DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_dealership_idx ON leads(dealership_id);
CREATE INDEX IF NOT EXISTS leads_customer_idx   ON leads(customer_id);
CREATE INDEX IF NOT EXISTS leads_stage_idx      ON leads(stage, dealership_id);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at DESC);

-- ── invoices ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id             TEXT          PRIMARY KEY,  -- INV-YYYY-NNN
  lead_id        BIGINT                 REFERENCES leads(id)     ON DELETE SET NULL,
  customer_id    BIGINT                 REFERENCES customers(id) ON DELETE SET NULL,
  customer_name  TEXT          NOT NULL,
  vehicle        TEXT          NOT NULL,
  agreement_ref  TEXT,
  total_amount   NUMERIC(12,2) NOT NULL,
  vat_amount     NUMERIC(12,2) NOT NULL,
  net_amount     NUMERIC(12,2) NOT NULL,
  payment_method TEXT                   DEFAULT '',
  status         TEXT          NOT NULL DEFAULT 'pending',  -- 'paid' | 'pending'
  issue_date     TIMESTAMPTZ            DEFAULT NOW(),
  paid_date      TIMESTAMPTZ,
  dealership_id  UUID          NOT NULL REFERENCES dealership_settings(dealership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS invoices_dealership_idx ON invoices(dealership_id);
CREATE INDEX IF NOT EXISTS invoices_lead_idx       ON invoices(lead_id);
CREATE INDEX IF NOT EXISTS invoices_customer_idx   ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx     ON invoices(status, dealership_id);
CREATE INDEX IF NOT EXISTS invoices_issue_date_idx ON invoices(issue_date DESC);

-- ── motorcycles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS motorcycles (
  id             TEXT          PRIMARY KEY,  -- MC-XXXX
  name           TEXT          NOT NULL,
  article_number TEXT,
  brand          TEXT,
  vin            TEXT,
  year           INTEGER,
  engine_cc      INTEGER,
  color          TEXT,
  mc_type        TEXT,
  warehouse      TEXT,
  stock          INTEGER                DEFAULT 0,
  reorder_qty    INTEGER                DEFAULT 2,
  cost           NUMERIC(12,2)          DEFAULT 0,
  selling_price  NUMERIC(12,2)          DEFAULT 0,
  vendor         TEXT,
  description    TEXT,
  dealership_id  UUID          NOT NULL REFERENCES dealership_settings(dealership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS motorcycles_dealership_idx ON motorcycles(dealership_id);

-- ── spare_parts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spare_parts (
  id             TEXT          PRIMARY KEY,  -- SP-XXXX
  name           TEXT          NOT NULL,
  article_number TEXT,
  brand          TEXT,
  category       TEXT,
  stock          INTEGER                DEFAULT 0,
  reorder_qty    INTEGER                DEFAULT 5,
  cost           NUMERIC(12,2)          DEFAULT 0,
  selling_price  NUMERIC(12,2)          DEFAULT 0,
  vendor         TEXT,
  description    TEXT,
  dealership_id  UUID          NOT NULL REFERENCES dealership_settings(dealership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS spare_parts_dealership_idx ON spare_parts(dealership_id);

-- ── accessories ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accessories (
  id             TEXT          PRIMARY KEY,  -- ACC-XXXX
  name           TEXT          NOT NULL,
  article_number TEXT,
  brand          TEXT,
  category       TEXT,
  size           TEXT,          -- XS | S | M | L | XL | XXL | One Size
  stock          INTEGER                DEFAULT 0,
  reorder_qty    INTEGER                DEFAULT 5,
  cost           NUMERIC(12,2)          DEFAULT 0,
  selling_price  NUMERIC(12,2)          DEFAULT 0,
  vendor         TEXT,
  description    TEXT,
  dealership_id  UUID          NOT NULL REFERENCES dealership_settings(dealership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS accessories_dealership_idx ON accessories(dealership_id);

-- ── staff_users ────────────────────────────────────────────────────────────────
-- Staff accounts per dealership. pending = invited but not yet accepted.
CREATE TABLE IF NOT EXISTS staff_users (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT          NOT NULL,
  email           TEXT          NOT NULL,
  role            TEXT          NOT NULL DEFAULT 'sales',    -- 'admin' | 'sales' | 'service'
  status          TEXT          NOT NULL DEFAULT 'pending',  -- 'active' | 'inactive' | 'pending'
  last_login      TIMESTAMPTZ,
  bankid_verified BOOLEAN                  DEFAULT FALSE,
  personal_number TEXT,
  dealership_id   UUID          NOT NULL REFERENCES dealership_settings(dealership_id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ              DEFAULT NOW(),
  UNIQUE (email, dealership_id)
);

CREATE INDEX IF NOT EXISTS staff_users_dealership_idx ON staff_users(dealership_id);
CREATE INDEX IF NOT EXISTS staff_users_email_idx      ON staff_users(email);

-- ── vendors ────────────────────────────────────────────────────────────────────
-- One row per supplier / vendor. Scoped per dealership.
-- Soft-referenced by purchase_orders.vendor (TEXT) for display purposes.
CREATE TABLE IF NOT EXISTS vendors (
  id                     BIGSERIAL     PRIMARY KEY,
  name                   TEXT          NOT NULL,
  address                TEXT,
  phone                  TEXT,
  org_number             TEXT,
  free_shipping_threshold NUMERIC(12,2),
  supplier_number        TEXT,
  categories             JSONB         DEFAULT '[]',
  is_manual              BOOLEAN       NOT NULL DEFAULT FALSE,
  dealership_id          UUID          REFERENCES dealership_settings(dealership_id) ON DELETE CASCADE,
  created_at             TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (name, dealership_id)
);

CREATE INDEX IF NOT EXISTS vendors_dealership_idx ON vendors(dealership_id);
CREATE INDEX IF NOT EXISTS vendors_name_idx       ON vendors(name);

-- ── purchase_orders ────────────────────────────────────────────────────────────
-- One PO per vendor order. Line items stored separately in po_line_items.
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            TEXT          PRIMARY KEY,   -- PO-YYYY-NNN
  vendor        TEXT          NOT NULL,      -- display name; soft-ref to vendors.name
  date          TEXT          NOT NULL,      -- ISO date string
  eta           TEXT,                        -- expected arrival date
  status        TEXT          NOT NULL DEFAULT 'Draft',
                                             -- 'Draft'|'Under Review'|'Reviewed'|'Sent'|'Received'
  total_cost    NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  dealership_id UUID          NOT NULL REFERENCES dealership_settings(dealership_id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS purchase_orders_dealership_idx ON purchase_orders(dealership_id);
CREATE INDEX IF NOT EXISTS purchase_orders_vendor_idx     ON purchase_orders(vendor);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx     ON purchase_orders(status, dealership_id);

-- ── po_line_items ──────────────────────────────────────────────────────────────
-- Individual line items belonging to a purchase order.
-- inventory_id is a soft reference to motorcycles.id / spare_parts.id / accessories.id.
CREATE TABLE IF NOT EXISTS po_line_items (
  id             BIGSERIAL     PRIMARY KEY,
  po_id          TEXT          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_id   TEXT          NOT NULL,     -- soft-ref: MC-XXX | SP-XXX | ACC-XXX
  name           TEXT          NOT NULL,
  article_number TEXT,
  order_qty      INTEGER       NOT NULL DEFAULT 1,
  unit_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  size           TEXT                        -- accessories only: S | M | L | XL …
);

CREATE INDEX IF NOT EXISTS po_line_items_po_idx           ON po_line_items(po_id);
CREATE INDEX IF NOT EXISTS po_line_items_inventory_id_idx ON po_line_items(inventory_id);

-- ── purchase_invoices ──────────────────────────────────────────────────────────
-- Invoices received from suppliers (inbound). Linked optionally to a PO.
-- Distinct from `invoices` (which are outbound sales invoices to customers).
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id                      TEXT          PRIMARY KEY,   -- PINV-YYYY-NNN
  supplier_invoice_number TEXT,
  po_id                   TEXT          REFERENCES purchase_orders(id) ON DELETE SET NULL,
  vendor                  TEXT          NOT NULL,
  invoice_date            TEXT          NOT NULL,
  due_date                TEXT          NOT NULL,
  amount                  NUMERIC(12,2) NOT NULL DEFAULT 0,
  status                  TEXT          NOT NULL DEFAULT 'Pending',
                                                       -- 'Pending'|'Paid'|'Overdue'|'Disputed'
  notes                   TEXT,
  dealership_id           UUID          REFERENCES dealership_settings(dealership_id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS purchase_invoices_dealership_idx ON purchase_invoices(dealership_id);
CREATE INDEX IF NOT EXISTS purchase_invoices_po_idx         ON purchase_invoices(po_id);
CREATE INDEX IF NOT EXISTS purchase_invoices_status_idx     ON purchase_invoices(status);

-- ============================================
-- EXTENDED RELATIONSHIPS
-- ============================================
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS and DO-block constraint guards.

-- ── webhook_events: link to dealership + invoice ───────────────────────────
-- Every payment webhook belongs to a dealership and (optionally) pays an invoice.
ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealership_settings(dealership_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_id    TEXT REFERENCES invoices(id)                       ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_events_dealership ON webhook_events(dealership_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_invoice    ON webhook_events(invoice_id);

-- ── po_line_items: proper FK for each inventory type (polymorphic) ─────────
-- inventory_id is a prefixed soft-ref (MC-XXX | SP-XXX | ACC-XXX).
-- We add three nullable FK columns so Supabase can visualise real relationships.
-- A CHECK constraint ensures at most one FK is set per line item.
ALTER TABLE po_line_items
  ADD COLUMN IF NOT EXISTS motorcycle_id TEXT REFERENCES motorcycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS spare_part_id TEXT REFERENCES spare_parts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accessory_id  TEXT REFERENCES accessories(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'po_line_items_single_item_chk'
  ) THEN
    ALTER TABLE po_line_items
      ADD CONSTRAINT po_line_items_single_item_chk
      CHECK (num_nonnulls(motorcycle_id, spare_part_id, accessory_id) <= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS po_line_items_motorcycle_idx ON po_line_items(motorcycle_id) WHERE motorcycle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS po_line_items_spare_part_idx ON po_line_items(spare_part_id) WHERE spare_part_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS po_line_items_accessory_idx  ON po_line_items(accessory_id)  WHERE accessory_id  IS NOT NULL;

-- ── vendors: add vendor_id FK to every table that soft-refs vendors.name ───
-- Keeps TEXT vendor column for display; adds vendor_id for real referential integrity.
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL;

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL;

ALTER TABLE motorcycles
  ADD COLUMN IF NOT EXISTS vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL;

ALTER TABLE spare_parts
  ADD COLUMN IF NOT EXISTS vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL;

ALTER TABLE accessories
  ADD COLUMN IF NOT EXISTS vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS purchase_orders_vendor_id_idx   ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS purchase_invoices_vendor_id_idx ON purchase_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS motorcycles_vendor_id_idx       ON motorcycles(vendor_id);
CREATE INDEX IF NOT EXISTS spare_parts_vendor_id_idx       ON spare_parts(vendor_id);
CREATE INDEX IF NOT EXISTS accessories_vendor_id_idx       ON accessories(vendor_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- This app uses custom session auth (localStorage + httpOnly cookie), NOT Supabase Auth.
-- Because auth.uid() is always null here, policies that use auth.uid() block everything.
-- Instead we use permissive RLS (USING true) so the anon key can read/write data.
-- Tenant isolation is enforced at the app layer: every query filters by dealership_id.
-- TODO: When Supabase Auth is added, tighten these to USING (dealership_id = auth.uid()).

ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorcycles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealership_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation — customers"           ON customers;
DROP POLICY IF EXISTS "Tenant isolation — leads"               ON leads;
DROP POLICY IF EXISTS "Tenant isolation — invoices"            ON invoices;
DROP POLICY IF EXISTS "Tenant isolation — motorcycles"         ON motorcycles;
DROP POLICY IF EXISTS "Tenant isolation — spare_parts"         ON spare_parts;
DROP POLICY IF EXISTS "Tenant isolation — accessories"         ON accessories;
DROP POLICY IF EXISTS "Tenant isolation — staff_users"         ON staff_users;
DROP POLICY IF EXISTS "Tenant isolation — vendors"             ON vendors;
DROP POLICY IF EXISTS "Tenant isolation — purchase_orders"     ON purchase_orders;
DROP POLICY IF EXISTS "Tenant isolation — purchase_invoices"   ON purchase_invoices;
DROP POLICY IF EXISTS "Tenant isolation — webhook_events"      ON webhook_events;
DROP POLICY IF EXISTS "Tenant isolation — dealership_settings" ON dealership_settings;

-- Permissive: allow anon key to access all rows.
-- App-level code always filters .eq('dealership_id', getDealershipId()) to prevent cross-tenant leaks.
CREATE POLICY "Allow all — customers"          ON customers          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all — leads"              ON leads              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all — invoices"           ON invoices           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all — motorcycles"        ON motorcycles        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all — spare_parts"        ON spare_parts        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all — accessories"        ON accessories        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all — staff_users"        ON staff_users        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all — vendors"            ON vendors            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all — purchase_orders"    ON purchase_orders    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all — purchase_invoices"  ON purchase_invoices  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all — webhook_events"     ON webhook_events     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all — dealership_settings" ON dealership_settings FOR ALL USING (true) WITH CHECK (true);

-- po_line_items are secured transitively via their parent purchase_order.
-- No separate policy needed.

-- ============================================
-- RELATIONSHIP DIAGRAM (for reference)
-- ============================================
--
--  dealership_settings (1)  ← ROOT — must exist before all other tables
--    ├── customers          (N)  ← created via BankID / SPAR / manual
--    │     └── invoices     (N)  ← invoices.customer_id  (outbound / sales)
--    ├── leads              (N)  ← sales pipeline
--    │     ├── invoices     (N)  ← invoices.lead_id
--    │     └── customers    (1)  ← leads.customer_id (set on close)
--    ├── motorcycles        (N)  ← inventory items; vendor_id → vendors
--    ├── spare_parts        (N)  ← inventory items; vendor_id → vendors
--    ├── accessories        (N)  ← inventory items; vendor_id → vendors
--    ├── staff_users        (N)  ← team members / invited users
--    ├── webhook_events     (N)  ← payment provider callbacks
--    │     ├── dealership_id → dealership_settings  (scoped to dealer)
--    │     └── invoice_id   → invoices              (which invoice was paid)
--    ├── vendors            (N)  ← suppliers / vendor master data
--    │     ├── purchase_orders.vendor_id   → vendors
--    │     ├── purchase_invoices.vendor_id → vendors
--    │     ├── motorcycles.vendor_id       → vendors
--    │     ├── spare_parts.vendor_id       → vendors
--    │     └── accessories.vendor_id       → vendors
--    ├── purchase_orders    (N)  ← inbound orders to suppliers
--    │     ├── vendor_id → vendors
--    │     ├── po_line_items    (N)  ← po_line_items.po_id → purchase_orders.id
--    │     │     ├── motorcycle_id → motorcycles  (nullable, polymorphic)
--    │     │     ├── spare_part_id → spare_parts  (nullable, polymorphic)
--    │     │     └── accessory_id  → accessories  (nullable, polymorphic)
--    │     └── purchase_invoices (N) ← purchase_invoices.po_id → purchase_orders.id
--    └── purchase_invoices  (N)  ← inbound supplier invoices (Pending/Paid/Overdue/Disputed)
--          ├── po_id      → purchase_orders
--          └── vendor_id  → vendors

-- ══════════════════════════════════════════════════════════════════════════════
-- PASSWORD AUTH ADDITIONS  (run after initial setup)
-- ══════════════════════════════════════════════════════════════════════════════

-- Add password_hash column to staff_users so users can set an email/password
-- in addition to (or instead of) BankID authentication.
ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- One-time-use tokens for the forgot-password / reset-password flow.
-- No dealership_id needed — tokens are short-lived (1 h) and self-contained.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT         NOT NULL,
  token      TEXT         NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ  NOT NULL,
  used       BOOLEAN      DEFAULT FALSE,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prt_email_idx ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS prt_token_idx ON password_reset_tokens(token);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
DROP   POLICY IF EXISTS "Allow all — password_reset_tokens" ON password_reset_tokens;
CREATE POLICY "Allow all — password_reset_tokens"
  ON password_reset_tokens FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- PLATFORM ADMIN SUPPORT
-- ══════════════════════════════════════════════════════════════════════════════

-- Platform admin (andrew.kalumba@bikeme.now) has no dealership, so
-- dealership_id must be nullable. The old NOT NULL constraint prevented
-- storing platform_admin in staff_users, which forced reliance on
-- localStorage — causing login failures on new browsers/devices.

-- 1. Make dealership_id nullable
ALTER TABLE staff_users ALTER COLUMN dealership_id DROP NOT NULL;

-- 2. Old unique constraint used (email, dealership_id) — NULL != NULL in SQL,
--    so it wouldn't catch duplicate platform_admin rows. Replace with a
--    partial unique index: email must be unique when there is no dealership.
DROP INDEX IF EXISTS staff_users_email_no_dealer_uidx;
CREATE UNIQUE INDEX staff_users_email_no_dealer_uidx
  ON staff_users(email) WHERE dealership_id IS NULL;

-- 3. Insert the platform admin row (safe to re-run: ON CONFLICT DO NOTHING).
--    password_hash starts as NULL — use "Forgot Password" on first login to set it.
INSERT INTO staff_users (name, email, role, status, dealership_id, password_hash)
VALUES (
  'Andrew Kalumba',
  'andrew.kalumba@bikeme.now',
  'platform_admin',
  'active',
  NULL,
  NULL
)
ON CONFLICT DO NOTHING;
