-- Run in Supabase Dashboard → SQL Editor

-- 1. Add approval status to goods_receipts
ALTER TABLE goods_receipts
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_approval'
        CHECK (status IN ('pending_approval', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS goods_receipts_status_idx ON goods_receipts(status);

-- 2. Add backorder tracking to goods_receipt_items
ALTER TABLE goods_receipt_items
    ADD COLUMN IF NOT EXISTS backorder_qty integer NOT NULL DEFAULT 0;

-- 3. Add received/backorder tracking to po_line_items
ALTER TABLE po_line_items
    ADD COLUMN IF NOT EXISTS received_qty  integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS backorder_qty integer NOT NULL DEFAULT 0;
