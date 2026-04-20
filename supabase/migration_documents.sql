-- Documents table + storage bucket setup
-- Run this in Supabase SQL editor if the documents table doesn't exist yet

CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id TEXT NOT NULL,
  lead_id       BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  customer_id   BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  file_size     BIGINT DEFAULT 0,
  mime_type     TEXT DEFAULT 'application/pdf',
  category      TEXT DEFAULT 'other'
                CHECK (category IN ('agreement','insurance','registration','invoice','other')),
  uploaded_by   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_dealer   ON documents(dealership_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead     ON documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow service-role (API routes) full access
DO $$ BEGIN
  CREATE POLICY "service role full access"
    ON documents FOR ALL
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
