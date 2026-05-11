-- ══════════════════════════════════════════════════════════════════════════════
-- FINANCIAL SUMMARY
-- Depends on: dealership_settings, purchase_orders (+ supabase-setup.sql)
-- Safe to re-run: all DDL uses IF NOT EXISTS / CREATE OR REPLACE guards.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. supplier_claims ────────────────────────────────────────────────────────
-- The app already writes to this table; this migration creates it if absent.

CREATE TABLE IF NOT EXISTS supplier_claims (
  id              TEXT          PRIMARY KEY,
                                -- CLM-{po_id}-{inventory_id}[-size]
  dealership_id   UUID          NOT NULL
                                REFERENCES dealership_settings(dealership_id)
                                ON DELETE CASCADE,
  po_id           TEXT          REFERENCES purchase_orders(id) ON DELETE SET NULL,
  vendor          TEXT          NOT NULL,
  inventory_id    TEXT,
  item_name       TEXT          NOT NULL,
  article_number  TEXT,
  size            TEXT,
  claim_type      TEXT          NOT NULL,
                                -- 'damaged' | 'short_delivered' | 'wrong_item'
  claimed_qty     INTEGER       NOT NULL DEFAULT 0,
  claimed_amount  NUMERIC(12,2),
  status          TEXT          NOT NULL DEFAULT 'open',
                                -- 'open' | 'submitted' | 'resolved' | 'credited'
  description     TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

ALTER TABLE supplier_claims ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'supplier_claims'
      AND policyname = 'Allow all — supplier_claims'
  ) THEN
    CREATE POLICY "Allow all — supplier_claims"
      ON supplier_claims FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ── 2. Indexes ────────────────────────────────────────────────────────────────
-- These complement the existing po_status_idx (status, dealership_id).
-- A partial index on open POs keeps the open-value scan tiny.

CREATE INDEX IF NOT EXISTS po_open_idx
  ON purchase_orders(dealership_id, total_cost)
  WHERE status IN ('Draft', 'Reviewed', 'Sent', 'Partial');

-- Monthly spend: filter by status + date prefix for the current month.
-- Expression index avoids a per-row regex+cast at query time.
CREATE INDEX IF NOT EXISTS po_received_date_idx
  ON purchase_orders(dealership_id, (date::DATE))
  WHERE status = 'Received'
    AND date ~ '^\d{4}-\d{2}-\d{2}$';

CREATE INDEX IF NOT EXISTS claims_open_idx
  ON supplier_claims(dealership_id, claimed_amount)
  WHERE status IN ('open', 'submitted');


-- ── 3. get_financial_summary ──────────────────────────────────────────────────
--
-- Single RPC call → three financial metrics for one dealership.
--
-- Parameters
--   p_dealership_id : UUID — required
--
-- Returns (one row)
--   open_po_value     total_cost of Draft / Reviewed / Sent / Partial POs
--   open_po_count     number of those POs
--   monthly_spend     total_cost of Received POs in the current calendar month
--   monthly_po_count  number of those POs
--   claims_value      sum of claimed_amount for open / submitted claims
--   claims_count      number of those claims
--
-- All money columns default to 0 (never NULL) so the UI can display directly.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_financial_summary(p_dealership_id UUID)
RETURNS TABLE (
  open_po_value    NUMERIC,
  open_po_count    BIGINT,
  monthly_spend    NUMERIC,
  monthly_po_count BIGINT,
  claims_value     NUMERIC,
  claims_count     BIGINT
)
LANGUAGE sql STABLE AS $fn$
  WITH
  po_agg AS (
    SELECT
      COALESCE(
        SUM(total_cost) FILTER (WHERE status IN ('Draft', 'Reviewed', 'Sent', 'Partial')),
        0
      )                                                              AS open_po_value,

      COUNT(*) FILTER (WHERE status IN ('Draft', 'Reviewed', 'Sent', 'Partial'))
                                                                     AS open_po_count,

      COALESCE(
        SUM(total_cost) FILTER (
          WHERE status = 'Received'
            AND date ~ '^\d{4}-\d{2}-\d{2}$'
            AND date::DATE >= DATE_TRUNC('month', CURRENT_DATE)
        ),
        0
      )                                                              AS monthly_spend,

      COUNT(*) FILTER (
        WHERE status = 'Received'
          AND date ~ '^\d{4}-\d{2}-\d{2}$'
          AND date::DATE >= DATE_TRUNC('month', CURRENT_DATE)
      )                                                              AS monthly_po_count

    FROM purchase_orders
    WHERE dealership_id = p_dealership_id
  ),
  claim_agg AS (
    SELECT
      COALESCE(SUM(claimed_amount), 0)  AS claims_value,
      COUNT(*)                          AS claims_count
    FROM supplier_claims
    WHERE dealership_id = p_dealership_id
      AND status IN ('open', 'submitted')
  )
  SELECT
    po_agg.open_po_value,
    po_agg.open_po_count,
    po_agg.monthly_spend,
    po_agg.monthly_po_count,
    claim_agg.claims_value,
    claim_agg.claims_count
  FROM po_agg, claim_agg
$fn$;


-- ══════════════════════════════════════════════════════════════════════════════
-- SUMMARY
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '✅ Financial summary migration applied:';
  RAISE NOTICE '  New table   : supplier_claims (if absent)';
  RAISE NOTICE '  New indexes : po_open_idx, po_received_date_idx, claims_open_idx';
  RAISE NOTICE '  New function: get_financial_summary(p_dealership_id UUID)';
  RAISE NOTICE '  Usage       : SELECT * FROM get_financial_summary(''<uuid>'')';
END $$;
