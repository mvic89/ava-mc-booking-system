-- Add bank_name column to dealership_settings
-- Run in Supabase SQL editor

ALTER TABLE dealership_settings
  ADD COLUMN IF NOT EXISTS bank_name TEXT;
