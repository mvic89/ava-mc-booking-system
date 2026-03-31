-- ── Migration: fix goods receipts for Vercel / production ────────────────────
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to run multiple times — all statements are idempotent.

-- 1. Add columns that the API inserts but were missing from the original schema
ALTER TABLE goods_receipts
    ADD COLUMN IF NOT EXISTS status  TEXT NOT NULL DEFAULT 'pending_approval',
    ADD COLUMN IF NOT EXISTS pdf_url TEXT;

ALTER TABLE goods_receipt_items
    ADD COLUMN IF NOT EXISTS backorder_qty INTEGER NOT NULL DEFAULT 0;

-- 2. Fix goods_receipt_items SELECT policy.
--    The original policy used current_setting('app.dealership_id') which is NULL
--    for the browser anon-key client, so it blocked ALL item reads.
--    The correct approach: let goods_receipts RLS handle tenant isolation; this
--    policy just confirms the parent receipt exists (inheriting the parent's RLS).
DROP POLICY IF EXISTS "Dealership can read own receipt items" ON goods_receipt_items;

CREATE POLICY "Dealership can read own receipt items"
    ON goods_receipt_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM goods_receipts gr
            WHERE gr.id = goods_receipt_items.receipt_id
        )
    );
