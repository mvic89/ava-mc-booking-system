-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Lead Management — activity log, scoring, lost deal tracking
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- Lead score (0–100 computed from signals)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score   INTEGER DEFAULT 0;

-- Lost deal reason (set when a lead is closed as lost)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason  TEXT;

-- Source column (already set via createLead, but may be missing on older rows)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source       TEXT;

-- ── Activity log ──────────────────────────────────────────────────────────────
-- Every action on a lead (stage change, call, email, note, score update)
-- is recorded here as an immutable append-only log.

CREATE TABLE IF NOT EXISTS lead_activities (
  id             BIGSERIAL     PRIMARY KEY,
  lead_id        INTEGER       NOT NULL,
  dealership_id  TEXT          NOT NULL,
  type           TEXT          NOT NULL,   -- 'note'|'call'|'email'|'meeting'|'stage_change'|'score_update'|'reminder'
  content        TEXT,
  meta           JSONB,                    -- arbitrary key/value for richer context
  created_by     TEXT,                    -- salesperson name
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_activities_lead_id_idx
  ON lead_activities (lead_id, dealership_id);

-- RLS: allow all for internal tool (same pattern as other tables)
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_activities' AND policyname = 'allow all'
  ) THEN
    CREATE POLICY "allow all" ON lead_activities FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
