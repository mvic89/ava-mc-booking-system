-- Run this in Supabase SQL editor
-- Step 1: Add pdf_url column to goods_receipts
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS pdf_url text;

-- Step 2: Add delivery_note_email and invoice_email to dealership_settings
ALTER TABLE dealership_settings
    ADD COLUMN IF NOT EXISTS delivery_note_email text,
    ADD COLUMN IF NOT EXISTS invoice_email text;

-- Step 3: Create the delivery-notes storage bucket
-- public = true so getPublicUrl() returns a working URL for the View PDF button
-- Alternatively, create via Supabase Dashboard → Storage → New bucket → name: delivery-notes, toggle Public ON
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-notes', 'delivery-notes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Step 4: Allow service role to read/write objects in the bucket
DROP POLICY IF EXISTS "service_role_delivery_notes" ON storage.objects;
CREATE POLICY "service_role_delivery_notes"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'delivery-notes');

-- Step 5: Allow anyone to read public delivery note PDFs (bucket is public)
DROP POLICY IF EXISTS "authenticated_read_delivery_notes" ON storage.objects;
CREATE POLICY "public_read_delivery_notes"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'delivery-notes');
