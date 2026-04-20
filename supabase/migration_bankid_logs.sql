-- ─── customer_bankid_logs ─────────────────────────────────────────────────────
-- Audit trail for every BankID event: logins, identity verifications,
-- agreement signings. Written server-side from /api/bankid/collect.
--
-- Actions:
--   auth             — staff login or lead BankID tab
--   verify_identity  — new customer onboarding (customers/new)
--   sign_agreement   — agreement dual-signature (both customer + dealer rows)
--
-- Run once in the Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.customer_bankid_logs (
  id              BIGSERIAL    PRIMARY KEY,
  customer_id     BIGINT       REFERENCES public.customers(id) ON DELETE CASCADE,

  action          TEXT         NOT NULL
                    CHECK (action IN ('auth', 'sign_agreement', 'verify_identity')),
  status          TEXT         NOT NULL
                    CHECK (status IN ('success', 'failed', 'pending')),

  personal_number TEXT,        -- 12-digit pnr (YYYYMMDDXXXX)
  ip_address      TEXT,        -- BankID device IP
  order_ref       TEXT,        -- BankID orderRef UUID
  signature       TEXT,        -- Raw BankID signature (sign mode only)
  risk_level      TEXT,        -- 'low' | 'moderate' | 'high'

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bankid_logs_customer
  ON public.customer_bankid_logs(customer_id);

CREATE INDEX IF NOT EXISTS idx_bankid_logs_created
  ON public.customer_bankid_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bankid_logs_pnr
  ON public.customer_bankid_logs(personal_number)
  WHERE personal_number IS NOT NULL;

-- Enable Realtime so the audit-log page updates live (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'customer_bankid_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_bankid_logs;
  END IF;
END;
$$;

-- RLS: staff can read logs for their dealership's customers;
-- service-role key (used by /api/bankid/collect) bypasses this.
ALTER TABLE public.customer_bankid_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bankid_logs_read" ON public.customer_bankid_logs;
CREATE POLICY "bankid_logs_read" ON public.customer_bankid_logs
  FOR SELECT
  USING (
    customer_id IS NULL
    OR customer_id IN (
      SELECT id FROM public.customers
      WHERE dealership_id = current_setting('app.dealership_id', TRUE)::uuid
    )
  );
