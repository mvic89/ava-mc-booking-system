-- ─── AVA Motorcycle Centre — Supabase Schema ─────────────────────────────────
-- Run this first in the Supabase SQL Editor, then run seed.sql

-- ── Motorcycles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS motorcycles (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  article_number TEXT NOT NULL,
  brand          TEXT NOT NULL,
  vin            TEXT,
  year           INTEGER,
  engine_cc      INTEGER,
  color          TEXT,
  mc_type        TEXT CHECK (mc_type IN ('New', 'Trade-In', 'Commission')),
  warehouse      TEXT CHECK (warehouse IN ('Warehouse A', 'Warehouse B', 'Warehouse C', 'Warehouse D')),
  stock          INTEGER NOT NULL DEFAULT 0,
  reorder_qty    INTEGER NOT NULL DEFAULT 0,
  cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendor         TEXT NOT NULL,
  description    TEXT
);

-- ── Spare Parts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spare_parts (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  article_number TEXT NOT NULL,
  brand          TEXT NOT NULL,
  category       TEXT NOT NULL,
  stock          INTEGER NOT NULL DEFAULT 0,
  reorder_qty    INTEGER NOT NULL DEFAULT 0,
  cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendor         TEXT NOT NULL,
  description    TEXT
);

-- ── Accessories ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accessories (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  article_number TEXT NOT NULL,
  brand          TEXT NOT NULL,
  category       TEXT NOT NULL,
  size           TEXT,
  stock          INTEGER NOT NULL DEFAULT 0,
  reorder_qty    INTEGER NOT NULL DEFAULT 0,
  cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendor         TEXT NOT NULL,
  description    TEXT
);

-- ── Vendors ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  name                     TEXT PRIMARY KEY,
  address                  TEXT,
  phone                    TEXT,
  org_number               TEXT,
  email                    TEXT,
  free_shipping_threshold  INTEGER
);

-- ── Purchase Orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id          TEXT PRIMARY KEY,
  vendor      TEXT NOT NULL,
  date        TEXT NOT NULL,
  eta         TEXT,
  status      TEXT NOT NULL,
  total_cost  NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes       TEXT
);

-- ── PO Line Items ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS po_line_items (
  id             BIGSERIAL PRIMARY KEY,
  po_id          TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_id   TEXT NOT NULL,
  name           TEXT NOT NULL,
  article_number TEXT NOT NULL,
  order_qty      INTEGER NOT NULL DEFAULT 1,
  unit_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  size           TEXT
);

-- ── Row Level Security (allow all for internal tool) ─────────────────────────
ALTER TABLE motorcycles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_line_items   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all" ON motorcycles     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON spare_parts     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON accessories     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON vendors         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON po_line_items   FOR ALL USING (true) WITH CHECK (true);
