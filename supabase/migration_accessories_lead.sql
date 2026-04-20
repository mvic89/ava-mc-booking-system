-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Accessories / Spare-Parts lead type
-- Adds lead_type and lead_items columns to the leads table so that
-- accessory-only purchases are stored and handled separately from motorcycle
-- sales that require the full pipeline (test ride → offer → agreement).
-- ─────────────────────────────────────────────────────────────────────────────

-- lead_type: 'motorcycle' (default, full pipeline) | 'accessories' (direct payment)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lead_type  TEXT NOT NULL DEFAULT 'motorcycle';

-- lead_items: JSON array of { id, name, brand, price, qty, itemType }
-- Populated for accessories leads; NULL for motorcycle leads.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lead_items JSONB;
