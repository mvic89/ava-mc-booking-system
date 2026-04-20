-- ─── NPS Surveys table ────────────────────────────────────────────────────────
-- Full NPS survey system with email delivery and public response URL
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.nps_surveys (
  id             BIGSERIAL    PRIMARY KEY,
  token          TEXT         NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  dealership_id  TEXT         NOT NULL,
  lead_id        BIGINT       REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id    BIGINT       REFERENCES public.customers(id) ON DELETE SET NULL,

  -- Who the survey was sent to
  recipient_name  TEXT         NOT NULL DEFAULT '',
  recipient_email TEXT         NOT NULL DEFAULT '',

  -- Response (null = not yet responded)
  score           INT          CHECK (score >= 0 AND score <= 10),
  comment         TEXT,

  -- Timestamps
  sent_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nps_surveys_dealership_id_idx ON public.nps_surveys(dealership_id);
CREATE INDEX IF NOT EXISTS nps_surveys_token_idx         ON public.nps_surveys(token);
CREATE INDEX IF NOT EXISTS nps_surveys_lead_id_idx       ON public.nps_surveys(lead_id);

ALTER TABLE public.nps_surveys ENABLE ROW LEVEL SECURITY;

-- Public token-based access for responding (no RLS needed for public route — handled in API)
DROP POLICY IF EXISTS "nps_surveys_dealership_isolation" ON public.nps_surveys;
CREATE POLICY "nps_surveys_dealership_isolation" ON public.nps_surveys
  USING (dealership_id = current_setting('app.dealership_id', TRUE));
