-- ─── purchase_order_items + work_order_id on purchase_orders ──────────────────
-- The service-integrated purchasing flow needs:
--   1. purchase_orders.work_order_id  — which work order triggered the PO
--   2. purchase_order_items           — line items with back-links to work_order_parts
--
-- Run in Supabase SQL Editor.

-- 1. Add work_order_id to purchase_orders (idempotent)
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS work_order_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_work_order ON public.purchase_orders(work_order_id);

-- 2. Create purchase_order_items table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id                  BIGSERIAL     PRIMARY KEY,
  purchase_order_id   TEXT          NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  work_order_id       BIGINT,
  work_order_part_id  BIGINT,
  article_number      TEXT          NOT NULL DEFAULT '',
  name                TEXT          NOT NULL,
  quantity            INT           NOT NULL DEFAULT 1,
  unit_cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  status              TEXT          NOT NULL DEFAULT 'ordered'
                      CHECK (status IN ('ordered', 'received')),
  received_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poi_purchase_order ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_work_order     ON public.purchase_order_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_wo_part        ON public.purchase_order_items(work_order_part_id);

-- 3. RLS: allow all (service-role key bypasses RLS anyway)
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all" ON public.purchase_order_items;
CREATE POLICY "allow_all" ON public.purchase_order_items
  FOR ALL USING (true) WITH CHECK (true);
