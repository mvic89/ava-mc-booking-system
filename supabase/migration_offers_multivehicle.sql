-- ─── Multi-vehicle & structured trade-in support ──────────────────────────────
-- Adds:
--   extra_vehicles  JSONB  — array of VehicleLineItem objects (extra vehicles on a deal)
--   trade_in_data   JSONB  — structured trade-in appraisal form data
-- Both default to an empty JSON structure so existing rows are unaffected.
-- Run once in the Supabase SQL Editor.

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS extra_vehicles JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS trade_in_data  JSONB;

COMMENT ON COLUMN public.offers.extra_vehicles IS
  'Array of {id, vehicle, vehicleColor, vehicleCondition, vin, registrationNumber, listPrice, discount} objects for multi-vehicle deals.';

COMMENT ON COLUMN public.offers.trade_in_data IS
  'Structured trade-in appraisal: {make, model, year, mileage, mileageUnit, condition, color, vin, notes, estimatedValue, offeredCredit}';
