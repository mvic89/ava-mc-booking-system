-- ─── Sales Targets & Commissions tables ───────────────────────────────────────
-- Track monthly targets per salesperson and commission earned per closed deal
-- Run in Supabase SQL Editor

-- Monthly targets per salesperson
CREATE TABLE IF NOT EXISTS public.sales_targets (
  id             BIGSERIAL    PRIMARY KEY,
  dealership_id  TEXT         NOT NULL,
  salesperson    TEXT         NOT NULL,
  year           INT          NOT NULL,
  month          INT          NOT NULL CHECK (month >= 1 AND month <= 12),
  target_units   INT          NOT NULL DEFAULT 0,
  target_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (dealership_id, salesperson, year, month)
);

CREATE INDEX IF NOT EXISTS sales_targets_dealership_idx ON public.sales_targets(dealership_id);
CREATE INDEX IF NOT EXISTS sales_targets_salesperson_idx ON public.sales_targets(salesperson);

DROP TRIGGER IF EXISTS sales_targets_updated_at ON public.sales_targets;
CREATE TRIGGER sales_targets_updated_at
  BEFORE UPDATE ON public.sales_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Commission ledger: one row per closed deal
CREATE TABLE IF NOT EXISTS public.commissions (
  id              BIGSERIAL    PRIMARY KEY,
  dealership_id   TEXT         NOT NULL,
  lead_id         BIGINT       REFERENCES public.leads(id) ON DELETE SET NULL,
  salesperson     TEXT         NOT NULL,

  -- Deal details
  customer_name   TEXT         NOT NULL DEFAULT '',
  vehicle_name    TEXT         NOT NULL DEFAULT '',
  deal_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Commission calculation
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,   -- percentage e.g. 3.50
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Status
  status          TEXT         NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'paid', 'voided')),
  paid_at         TIMESTAMPTZ,
  approved_by     TEXT,

  closed_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  notes           TEXT         NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS commissions_dealership_id_idx ON public.commissions(dealership_id);
CREATE INDEX IF NOT EXISTS commissions_salesperson_idx   ON public.commissions(salesperson);
CREATE INDEX IF NOT EXISTS commissions_status_idx        ON public.commissions(status);
CREATE INDEX IF NOT EXISTS commissions_closed_at_idx     ON public.commissions(closed_at);

DROP TRIGGER IF EXISTS commissions_updated_at ON public.commissions;
CREATE TRIGGER commissions_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_targets_dealership_isolation" ON public.sales_targets;
CREATE POLICY "sales_targets_dealership_isolation" ON public.sales_targets
  USING (dealership_id = current_setting('app.dealership_id', TRUE));

DROP POLICY IF EXISTS "commissions_dealership_isolation" ON public.commissions;
CREATE POLICY "commissions_dealership_isolation" ON public.commissions
  USING (dealership_id = current_setting('app.dealership_id', TRUE));
