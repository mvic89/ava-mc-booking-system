-- ─── Invoice Tables ────────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor AFTER running schema.sql

-- Purchase Invoices (invoices received from suppliers)
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id                      TEXT PRIMARY KEY,            -- e.g. PINV-2026-001
  supplier_invoice_number TEXT NOT NULL,               -- supplier's own invoice ref
  po_id                   TEXT REFERENCES purchase_orders(id) ON DELETE SET NULL,
  vendor                  TEXT NOT NULL,
  invoice_date            TEXT NOT NULL,               -- ISO date string
  due_date                TEXT NOT NULL,
  amount                  NUMERIC NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'Pending'
                          CHECK (status IN ('Pending','Paid','Overdue','Disputed')),
  notes                   TEXT
);

-- Sales Invoices (invoices sent to customers)
CREATE TABLE IF NOT EXISTS sales_invoices (
  id              TEXT PRIMARY KEY,                    -- e.g. SINV-2026-001
  customer_name   TEXT NOT NULL,
  customer_email  TEXT,
  customer_phone  TEXT,
  invoice_date    TEXT NOT NULL,
  due_date        TEXT NOT NULL,
  total_amount    NUMERIC NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'Draft'
                  CHECK (status IN ('Draft','Sent','Paid','Overdue')),
  notes           TEXT
);

-- Sales Invoice Line Items
CREATE TABLE IF NOT EXISTS sales_invoice_items (
  id              BIGSERIAL PRIMARY KEY,
  invoice_id      TEXT NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  inventory_id    TEXT,
  name            TEXT NOT NULL,
  article_number  TEXT,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      NUMERIC NOT NULL DEFAULT 0,
  line_total      NUMERIC NOT NULL DEFAULT 0,
  size            TEXT
);

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE purchase_invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all" ON purchase_invoices   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON sales_invoices      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON sales_invoice_items FOR ALL USING (true) WITH CHECK (true);
