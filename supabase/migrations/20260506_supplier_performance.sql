-- ══════════════════════════════════════════════════════════════════════════════
-- SUPPLIER PERFORMANCE TRACKING
-- Run after supabase-setup.sql (requires: dealership_settings, vendors,
-- purchase_orders, po_line_items)
-- Safe to re-run: all DDL uses IF NOT EXISTS / CREATE OR REPLACE guards.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. goods_receipts ─────────────────────────────────────────────────────────
-- One row per delivery note received from a supplier.
-- Created here because no migration file previously defined this table,
-- even though the goods-receipt API already writes to it.

CREATE TABLE IF NOT EXISTS goods_receipts (
  id                   TEXT          PRIMARY KEY,  -- GR-XXX-YYYY-NNN
  dealership_id        UUID          NOT NULL
                                     REFERENCES dealership_settings(dealership_id)
                                     ON DELETE CASCADE,
  po_id                TEXT          REFERENCES purchase_orders(id) ON DELETE SET NULL,
  vendor               TEXT          NOT NULL,
  delivery_note_number TEXT,
  received_date        TEXT          NOT NULL,     -- YYYY-MM-DD (normalised on insert)
  received_by          TEXT,
  notes                TEXT,
  raw_text             TEXT,
  source               TEXT          NOT NULL DEFAULT 'manual',
                                                   -- 'manual' | 'email_automation'
  status               TEXT          NOT NULL DEFAULT 'pending_approval',
                                                   -- 'pending_approval' | 'approved' | 'rejected'
  pdf_url              TEXT,
  created_at           TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gr_dealership_idx  ON goods_receipts(dealership_id);
CREATE INDEX IF NOT EXISTS gr_po_idx          ON goods_receipts(po_id);
CREATE INDEX IF NOT EXISTS gr_status_idx      ON goods_receipts(status, dealership_id);
CREATE INDEX IF NOT EXISTS gr_received_at_idx ON goods_receipts(received_date DESC);

ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'goods_receipts'
      AND policyname = 'Allow all — goods_receipts'
  ) THEN
    CREATE POLICY "Allow all — goods_receipts"
      ON goods_receipts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ── 2. goods_receipt_items ────────────────────────────────────────────────────
-- One row per SKU per delivery note.
-- damaged_qty is the only field added beyond what the API already writes.

CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id             BIGSERIAL     PRIMARY KEY,
  receipt_id     TEXT          NOT NULL
                               REFERENCES goods_receipts(id) ON DELETE CASCADE,
  inventory_id   TEXT,                             -- soft-ref: MC-XXX | SP-XXX | ACC-XXX
  article_number TEXT,
  name           TEXT          NOT NULL,
  ordered_qty    INTEGER,                           -- NULL when delivery note omits this column
  received_qty   INTEGER       NOT NULL DEFAULT 0,
  backorder_qty  INTEGER       NOT NULL DEFAULT 0,  -- ordered_qty - received_qty (> 0 = short-ship)
  damaged_qty    INTEGER       NOT NULL DEFAULT 0,  -- units received but damaged/unusable
  unit_cost      NUMERIC(12,2),
  matched        BOOLEAN       NOT NULL DEFAULT FALSE,  -- TRUE when inventory_id was resolved
  created_at     TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gri_receipt_idx   ON goods_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS gri_inventory_idx ON goods_receipt_items(inventory_id);

ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'goods_receipt_items'
      AND policyname = 'Allow all — goods_receipt_items'
  ) THEN
    CREATE POLICY "Allow all — goods_receipt_items"
      ON goods_receipt_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Backfill: add damaged_qty if goods_receipt_items already existed without it.
ALTER TABLE goods_receipt_items
  ADD COLUMN IF NOT EXISTS damaged_qty INTEGER NOT NULL DEFAULT 0;


-- ── 3. Auto-populate purchase_orders.received_at ──────────────────────────────
-- The approve route sets purchase_orders.status = 'Received' but never writes
-- received_at. This BEFORE trigger fills it the moment the status flips so that
-- the on-time metric has an accurate timestamp without changing the API code.

CREATE OR REPLACE FUNCTION fn_po_received_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.received_at IS NULL THEN
    NEW.received_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_po_received_at ON purchase_orders;
CREATE TRIGGER trg_po_received_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.status = 'Received' AND OLD.status IS DISTINCT FROM 'Received')
  EXECUTE FUNCTION fn_po_received_at();

-- Indexes used by the metrics queries.
CREATE INDEX IF NOT EXISTS po_received_at_idx
  ON purchase_orders(received_at) WHERE received_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS po_eta_vendor_idx
  ON purchase_orders(vendor_id, eta) WHERE eta IS NOT NULL AND eta <> '';


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. SUPPLIER PERFORMANCE FUNCTION
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Returns one row per vendor with four computed metrics.
--
-- Parameters
--   p_dealership_id : UUID  — filter to this dealership (required)
--   p_days          : INT   — look-back window in days   (default 365)
--
-- Metrics
--   on_time_pct        % of approved receipts where received_date ≤ po.eta
--                      NULL when no POs in the window had an eta set
--   backorder_rate     % of ordered units that arrived short-shipped
--                      NULL when ordered_qty was never captured
--   damage_rate        % of received units flagged as damaged
--                      NULL when no items have been received yet
--   avg_lead_time_days average calendar days from PO order date to receipt date
--                      NULL when no approved receipts exist in the window
--
-- Dependency: purchase_orders.vendor_id must be populated.
-- POs that still have vendor_id = NULL (set manually before the FK was added)
-- are picked up via the OR fallback (po.vendor = v.name).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_supplier_metrics(
  p_dealership_id UUID,
  p_days          INTEGER DEFAULT 365
)
RETURNS TABLE (
  vendor_id          BIGINT,
  vendor_name        TEXT,
  total_pos          BIGINT,
  on_time_pct        NUMERIC,
  backorder_rate     NUMERIC,
  damage_rate        NUMERIC,
  avg_lead_time_days NUMERIC
)
LANGUAGE sql STABLE AS $fn$
  SELECT
    v.id                                                AS vendor_id,
    v.name                                              AS vendor_name,

    COUNT(DISTINCT po.id)                               AS total_pos,

    -- On-time %: approved receipts where received_date ≤ eta
    ROUND(
      100.0
        * COUNT(gr.id) FILTER (
            WHERE gr.status = 'approved'
              AND po.eta IS NOT NULL AND po.eta <> ''
              AND gr.received_date::DATE <= po.eta::DATE
          )
        / NULLIF(
            COUNT(gr.id) FILTER (
              WHERE gr.status = 'approved'
                AND po.eta IS NOT NULL AND po.eta <> ''
            ), 0
          ),
      1
    )                                                   AS on_time_pct,

    -- Backorder rate: units short-shipped / total units ordered
    ROUND(
      100.0
        * SUM(gri.backorder_qty) FILTER (WHERE gr.status = 'approved')
        / NULLIF(
            SUM(gri.ordered_qty) FILTER (WHERE gr.status = 'approved'),
            0
          ),
      1
    )                                                   AS backorder_rate,

    -- Damage rate: damaged units / total received units
    ROUND(
      100.0
        * SUM(gri.damaged_qty)   FILTER (WHERE gr.status = 'approved')
        / NULLIF(
            SUM(gri.received_qty) FILTER (WHERE gr.status = 'approved'),
            0
          ),
      1
    )                                                   AS damage_rate,

    -- Avg lead time: PO order date → first approved receipt date (calendar days)
    ROUND(
      AVG(gr.received_date::DATE - po.date::DATE)
        FILTER (WHERE gr.status = 'approved'),
      1
    )                                                   AS avg_lead_time_days

  FROM vendors v
  JOIN purchase_orders po
       ON  (po.vendor_id = v.id OR (po.vendor_id IS NULL AND po.vendor = v.name))
       AND po.dealership_id = p_dealership_id
       AND po.date::DATE   >= CURRENT_DATE - (p_days || ' days')::INTERVAL
       AND po.status        IN ('Sent', 'Partial', 'Received')
  LEFT JOIN goods_receipts gr
       ON  gr.po_id         = po.id
  LEFT JOIN goods_receipt_items gri
       ON  gri.receipt_id   = gr.id

  WHERE v.dealership_id = p_dealership_id

  GROUP BY v.id, v.name
  HAVING COUNT(DISTINCT po.id) > 0
  ORDER BY total_pos DESC, v.name
$fn$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. MATERIALIZED VIEW  (recommended for the purchase dashboard)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- WHY a materialized view rather than calling the function directly:
--   - Goods receipts arrive infrequently (a few per day at most).
--   - The JOIN across purchase_orders + goods_receipts + items is a full scan
--     each time the purchase page loads. A MV brings that to an index-seek.
--   - CONCURRENTLY refresh means the old data stays readable during the refresh
--     (no table lock, no blank page flicker).
--
-- HOW to refresh:
--   Option A — manual, after approving a receipt:
--     REFRESH MATERIALIZED VIEW CONCURRENTLY supplier_performance_mv;
--
--   Option B — scheduled nightly via pg_cron (recommended):
--     SELECT cron.schedule(
--       'refresh-supplier-perf',
--       '0 4 * * *',
--       $$REFRESH MATERIALIZED VIEW CONCURRENTLY supplier_performance_mv$$
--     );
--
-- NOTE: DROP + CREATE is used here so the view definition stays updatable
-- without migration conflicts. Because WITH DATA is specified, the view is
-- immediately populated on first run.
-- ══════════════════════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS supplier_performance_mv;

CREATE MATERIALIZED VIEW supplier_performance_mv AS
  SELECT
    po.dealership_id,
    v.id                                                AS vendor_id,
    v.name                                              AS vendor_name,

    COUNT(DISTINCT po.id)                               AS total_pos,

    -- gr.received_date is DATE; po.eta is TEXT — guard with regex before casting
    ROUND(
      100.0
        * COUNT(gr.id) FILTER (
            WHERE gr.status = 'approved'
              AND po.eta IS NOT NULL AND po.eta ~ '^\d{4}-\d{2}-\d{2}$'
              AND gr.received_date <= po.eta::DATE
          )
        / NULLIF(
            COUNT(gr.id) FILTER (
              WHERE gr.status = 'approved'
                AND po.eta IS NOT NULL AND po.eta ~ '^\d{4}-\d{2}-\d{2}$'
            ), 0
          ),
      1
    )                                                   AS on_time_pct,

    ROUND(
      100.0
        * SUM(gri.backorder_qty) FILTER (WHERE gr.status = 'approved')
        / NULLIF(
            SUM(gri.ordered_qty) FILTER (WHERE gr.status = 'approved'),
            0
          ),
      1
    )                                                   AS backorder_rate,

    ROUND(
      100.0
        * SUM(gri.damaged_qty)   FILTER (WHERE gr.status = 'approved')
        / NULLIF(
            SUM(gri.received_qty) FILTER (WHERE gr.status = 'approved'),
            0
          ),
      1
    )                                                   AS damage_rate,

    -- gr.received_date is DATE; po.date is TEXT — guard with regex before casting
    ROUND(
      AVG(gr.received_date - po.date::DATE)
        FILTER (WHERE gr.status = 'approved'),
      1
    )                                                   AS avg_lead_time_days,

    NOW()                                               AS refreshed_at

  FROM vendors v
  JOIN purchase_orders po
       ON  (po.vendor_id = v.id OR (po.vendor_id IS NULL AND po.vendor = v.name))
       AND po.date ~ '^\d{4}-\d{2}-\d{2}$'
       AND po.date::DATE >= CURRENT_DATE - INTERVAL '365 days'
       AND po.status      IN ('Sent', 'Partial', 'Received')
  LEFT JOIN goods_receipts gr
       ON  gr.po_id       = po.id
  LEFT JOIN goods_receipt_items gri
       ON  gri.receipt_id = gr.id

  GROUP BY po.dealership_id, v.id, v.name
  HAVING COUNT(DISTINCT po.id) > 0

WITH DATA;

-- Unique index is required for CONCURRENTLY refresh.
CREATE UNIQUE INDEX supplier_performance_mv_uidx
  ON supplier_performance_mv(dealership_id, vendor_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- SUMMARY
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '✅ Supplier performance migration applied:';
  RAISE NOTICE '  New tables  : goods_receipts, goods_receipt_items';
  RAISE NOTICE '  New column  : goods_receipt_items.damaged_qty (DEFAULT 0)';
  RAISE NOTICE '  New trigger : trg_po_received_at — auto-fills purchase_orders.received_at';
  RAISE NOTICE '  New function: get_supplier_metrics(dealership_id, days)';
  RAISE NOTICE '  New MV      : supplier_performance_mv (365-day window, all dealerships)';
  RAISE NOTICE '  Refresh MV  : REFRESH MATERIALIZED VIEW CONCURRENTLY supplier_performance_mv';
  RAISE NOTICE '  Or schedule : SELECT cron.schedule(''refresh-supplier-perf'', ''0 4 * * *'', ...)';
END $$;
