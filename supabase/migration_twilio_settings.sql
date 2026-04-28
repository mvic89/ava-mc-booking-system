-- Add Twilio SMS credentials to dealership_settings
-- (dealerships table already has these columns from migration_notification_channels.sql)
-- Run this in Supabase SQL editor

ALTER TABLE dealership_settings
  ADD COLUMN IF NOT EXISTS twilio_account_sid  TEXT,
  ADD COLUMN IF NOT EXISTS twilio_auth_token   TEXT,
  ADD COLUMN IF NOT EXISTS twilio_from_number  TEXT;
