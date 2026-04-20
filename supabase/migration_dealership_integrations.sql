-- Integration credentials store (replaces data/integration-configs.json)
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS dealership_integrations (
  dealership_id   TEXT    NOT NULL,
  integration_id  TEXT    NOT NULL,
  dealer_name     TEXT,
  credentials     JSONB   NOT NULL DEFAULT '{}',
  enabled         BOOLEAN NOT NULL DEFAULT false,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dealership_id, integration_id)
);

CREATE INDEX IF NOT EXISTS dealership_integrations_did_idx
  ON dealership_integrations (dealership_id);

-- RLS: only service-role can read/write (API routes use service-role key)
ALTER TABLE dealership_integrations ENABLE ROW LEVEL SECURITY;
