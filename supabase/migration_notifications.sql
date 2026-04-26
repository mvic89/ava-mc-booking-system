-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: notifications table
-- Run once in the Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- NotificationBell subscribes to INSERTs via Supabase Realtime.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id  TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('lead','agreement','payment','customer','system')),
  title          TEXT NOT NULL,
  message        TEXT NOT NULL DEFAULT '',
  href           TEXT,
  read           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_dealership_unread
  ON public.notifications (dealership_id, read, created_at DESC);
