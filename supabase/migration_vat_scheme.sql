-- VAT / Moms scheme columns on invoices
-- Supports: normal (25% on full price), margin (9a kap ML — used vehicles), exempt

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS vat_scheme     TEXT    NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS margin_amount  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency_code  TEXT    NOT NULL DEFAULT 'SEK',
  ADD COLUMN IF NOT EXISTS currency_rate  NUMERIC(10,6) NOT NULL DEFAULT 1;

-- Constraint: only valid scheme values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_vat_scheme_check'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_vat_scheme_check
      CHECK (vat_scheme IN ('normal', 'margin', 'exempt'));
  END IF;
END $$;

-- Index for momsredovisning queries (filter by period + scheme)
CREATE INDEX IF NOT EXISTS invoices_vat_period_idx ON invoices (dealership_id, vat_scheme, issue_date);

COMMENT ON COLUMN invoices.vat_scheme     IS 'normal=25% full price, margin=9a kap ML, exempt=momsfri';
COMMENT ON COLUMN invoices.purchase_price IS 'Dealer purchase price (SEK) — required for margin scheme';
COMMENT ON COLUMN invoices.margin_amount  IS 'Selling price - purchase price (margin scheme)';
COMMENT ON COLUMN invoices.currency_code  IS 'Original currency for imported vehicles (SEK, EUR, JPY…)';
COMMENT ON COLUMN invoices.currency_rate  IS 'Exchange rate to SEK at time of purchase (for hedging P&L)';
