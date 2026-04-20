-- Add IBAN and BIC columns to dealership_settings
-- Run this in Supabase SQL editor

ALTER TABLE dealership_settings
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS bic  TEXT;
