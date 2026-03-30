-- Run this in Supabase Dashboard → SQL Editor
-- Notifications are read/written only by the server using the service role key,
-- so RLS is enabled but policies allow all (service role bypasses RLS anyway).

CREATE TABLE IF NOT EXISTS notifications (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id uuid NOT NULL,
    type          text NOT NULL DEFAULT 'system',
    title         text NOT NULL,
    message       text NOT NULL,
    href          text,
    read          boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_dealership_id_idx ON notifications(dealership_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx    ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON notifications FOR ALL USING (true) WITH CHECK (true);
