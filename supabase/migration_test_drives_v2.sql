-- migration_test_drives_v2.sql
-- Adds insurance fee and digital signature columns to test_drives

ALTER TABLE public.test_drives
  ADD COLUMN IF NOT EXISTS insurance_fee       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_signature    TEXT          NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS staff_signature     TEXT          NOT NULL DEFAULT '';
