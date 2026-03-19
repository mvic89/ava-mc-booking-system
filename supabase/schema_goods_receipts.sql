-- ─── Goods Receipts ──────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor.
-- Each row = one physical delivery batch received from a vendor.

CREATE TABLE IF NOT EXISTS goods_receipts (
    id              TEXT        PRIMARY KEY,          -- e.g. GR-AVA-2026-001
    dealership_id   UUID        NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    po_id           TEXT,                             -- optional link to purchase_orders.id
    vendor          TEXT        NOT NULL,
    delivery_note_number TEXT,                        -- number on the physical/PDF delivery note
    received_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
    received_by     TEXT,                             -- staff name / email
    notes           TEXT,
    raw_text        TEXT,                             -- full text extracted from PDF (for audit)
    source          TEXT        NOT NULL DEFAULT 'manual',  -- 'manual' | 'email_automation'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id              BIGSERIAL   PRIMARY KEY,
    receipt_id      TEXT        NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    inventory_id    TEXT,                             -- matched inventory row id (MC-/SP-/ACC-)
    article_number  TEXT,
    name            TEXT        NOT NULL,
    ordered_qty     INTEGER,                          -- from PO (if linked)
    received_qty    INTEGER     NOT NULL,
    unit_cost       NUMERIC(12,2),
    matched         BOOLEAN     NOT NULL DEFAULT FALSE  -- true when inventory_id resolved
);

-- Indexes
CREATE INDEX IF NOT EXISTS goods_receipts_dealership_idx ON goods_receipts(dealership_id);
CREATE INDEX IF NOT EXISTS goods_receipts_po_idx         ON goods_receipts(po_id);
CREATE INDEX IF NOT EXISTS goods_receipt_items_receipt_idx ON goods_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS goods_receipt_items_inventory_idx ON goods_receipt_items(inventory_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Your app uses the anon key with dealership_id scoping (not Supabase Auth JWT).
-- RLS is therefore enforced at the application layer via .eq('dealership_id', ...)
-- in every query. The policies below add a second layer of defence.

ALTER TABLE goods_receipts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items  ENABLE ROW LEVEL SECURITY;

-- ── goods_receipts: allow all operations only for matching dealership ──────────

CREATE POLICY "Dealership can read own receipts"
    ON goods_receipts FOR SELECT
    USING (dealership_id::text = current_setting('app.dealership_id', true));

CREATE POLICY "Dealership can insert own receipts"
    ON goods_receipts FOR INSERT
    WITH CHECK (dealership_id::text = current_setting('app.dealership_id', true));

CREATE POLICY "Dealership can update own receipts"
    ON goods_receipts FOR UPDATE
    USING (dealership_id::text = current_setting('app.dealership_id', true));

CREATE POLICY "Dealership can delete own receipts"
    ON goods_receipts FOR DELETE
    USING (dealership_id::text = current_setting('app.dealership_id', true));

-- ── goods_receipt_items: inherit access through parent receipt ────────────────

CREATE POLICY "Dealership can read own receipt items"
    ON goods_receipt_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM goods_receipts gr
            WHERE gr.id = goods_receipt_items.receipt_id
            AND gr.dealership_id::text = current_setting('app.dealership_id', true)
        )
    );

CREATE POLICY "Dealership can insert own receipt items"
    ON goods_receipt_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM goods_receipts gr
            WHERE gr.id = goods_receipt_items.receipt_id
            AND gr.dealership_id::text = current_setting('app.dealership_id', true)
        )
    );

CREATE POLICY "Dealership can delete own receipt items"
    ON goods_receipt_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM goods_receipts gr
            WHERE gr.id = goods_receipt_items.receipt_id
            AND gr.dealership_id::text = current_setting('app.dealership_id', true)
        )
    );

-- ── Webhook API bypass ────────────────────────────────────────────────────────
-- The /api/goods-receipt route runs server-side with the service_role key,
-- which bypasses RLS entirely — no extra policy needed there.
-- If you switch to the anon key on the server, add:
--   SET LOCAL app.dealership_id = '<uuid>';
-- before each server-side query.
