-- Extended VAT support: cost_price on agreements, FX fields on motorcycles, line-item VAT on invoices
-- Run in Supabase SQL Editor

-- Gap 2: cost_price on agreements for margin scheme calculation
ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;

-- Gap 3: FX / import cost tracking on motorcycles
ALTER TABLE motorcycles
  ADD COLUMN IF NOT EXISTS cost_currency       TEXT,
  ADD COLUMN IF NOT EXISTS cost_amount_foreign NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_fx_rate        NUMERIC;

COMMENT ON COLUMN motorcycles.cost_currency       IS 'Original invoice currency, e.g. EUR';
COMMENT ON COLUMN motorcycles.cost_amount_foreign IS 'Original purchase amount in foreign currency';
COMMENT ON COLUMN motorcycles.cost_fx_rate        IS 'Hedged SEK/foreign-unit rate at time of purchase';

-- Gap 4: JSONB line items on invoices for mixed new/used VAT
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_lines JSONB;

COMMENT ON COLUMN invoices.invoice_lines IS 'Array of {description, totalAmount, vatScheme, purchasePrice, netAmount, vatAmount}';
