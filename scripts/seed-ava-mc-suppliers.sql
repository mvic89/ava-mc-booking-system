-- ─────────────────────────────────────────────────────────────────────────────
-- AVA MC — Supplier & Inventory Seed
-- Run this in Supabase Dashboard → SQL Editor
--
-- STEP 1: Find your dealership ID first by running:
--   SELECT id, name FROM dealerships;
-- Then replace 'YOUR_DEALERSHIP_ID' below with your actual UUID.
-- ─────────────────────────────────────────────────────────────────────────────

-- Set your dealership ID here (get it from: SELECT id FROM dealerships LIMIT 5)
DO $$
DECLARE
  did     uuid := (SELECT id FROM dealerships WHERE name ILIKE '%AVA MC%' LIMIT 1);
  tag     text;
  base    int;
BEGIN
  -- Derive 3-letter tag from dealership name (mirrors getDealershipTag() in code)
  tag  := UPPER(LEFT(REGEXP_REPLACE(
            (SELECT name FROM dealerships WHERE id = did), '[^A-Za-z]', '', 'g'
          ), 3));
  -- UUID fingerprint: first 4 hex chars of dealership UUID (mirrors generateNextId in code)
  -- e.g. UUID "4d85xxxx-..." → fingerprint "4D85"
  -- Format: SUP-{TAG}-{FP}-{SEQ}  e.g. SUP-AVA-4D85-001
  tag  := tag || '-' || UPPER(LEFT(REPLACE(did::text, '-', ''), 4));
  -- Next supplier number = current count + 1
  base := (SELECT COUNT(*) FROM vendors WHERE dealership_id = did)::int;

-- ─── 1. INSERT SUPPLIERS (vendors table) ─────────────────────────────────────

INSERT INTO vendors (
  dealership_id, supplier_number, name, address, phone, email,
  org_number, contact_person, free_shipping_threshold,
  is_manual, categories
) VALUES
(
  did,
  'SUP-' || tag || '-' || LPAD((base + 1)::text, 3, '0'),
  'Vartex AB',
  'Batterivägen 14, 432 32 Varberg, Sweden',
  '+46 340-549690',
  'Respons@vartex.se',
  'SE559291969901',
  'Vartex Support',
  3000,
  true,
  ARRAY['Accessories']
),
(
  did,
  'SUP-' || tag || '-' || LPAD((base + 2)::text, 3, '0'),
  'Duell AB',
  'Bredkransvägen 10, 573 92 Tranås, Sweden',
  '+358 (0)20 118 000',
  'info@duell.eu',
  'SE556000-0000',
  'Duell Support',
  2000,
  true,
  ARRAY['Accessories']
),
(
  did,
  'SUP-' || tag || '-' || LPAD((base + 3)::text, 3, '0'),
  'Shoei Distribution GmbH',
  'Elisabeth-Selbert-Straße 13, 40764 Langenfeld, Germany',
  '+49 (0)2173 39 975-0',
  'info@shoei-europe.com',
  'HRB 41489 Düsseldorf',
  'Shoei Support',
  5000,
  true,
  ARRAY['Accessories']
)
ON CONFLICT (name, dealership_id) DO UPDATE SET
  address                 = EXCLUDED.address,
  phone                   = EXCLUDED.phone,
  email                   = EXCLUDED.email,
  org_number              = EXCLUDED.org_number,
  free_shipping_threshold = EXCLUDED.free_shipping_threshold;


-- ─── 2. INSERT ACCESSORIES (from Vartex delivery note) ───────────────────────
-- SKYDDSTRÖJA KNOX URBANE PRO MK3 HE

INSERT INTO accessories (
  dealership_id, name, article_number, supplier, stock, price, category
) VALUES
(
  did,
  'SKYDDSTRÖJA KNOX URBANE PRO MK3 HE - Size M',
  '501190Z005-A5',
  'Vartex AB',
  0,
  0,
  'Protective Jacket'
),
(
  did,
  'SKYDDSTRÖJA KNOX URBANE PRO MK3 HE - Size L',
  '501190Z005-A6',
  'Vartex AB',
  0,
  0,
  'Protective Jacket'
)
ON CONFLICT (article_number, dealership_id) DO NOTHING;


-- ─── 3. INSERT ACCESSORIES (from Duell delivery note) ────────────────────────

INSERT INTO accessories (
  dealership_id, name, article_number, supplier, stock, price, category
) VALUES
(
  did,
  'Alpinestars Byxa AST-1 v2 Kort Drystar Svart 3XL',
  '692-3226221-10-6',
  'Duell AB',
  0,
  2795,
  'Textile Pants'
),
(
  did,
  'Alpinestars Handske Dam SP-8 v3 Svart/Vit XS',
  '694-3518321-12-0',
  'Duell AB',
  0,
  1499,
  'Gloves'
),
(
  did,
  'Alpinestars Handske Dam SP-8 v3 Svart/Vit S',
  '694-3518321-12-1',
  'Duell AB',
  0,
  1499,
  'Gloves'
),
(
  did,
  'Alpinestars Handske Dam SP-8 v3 Svart/Vit M',
  '694-3518321-12-2',
  'Duell AB',
  0,
  1499,
  'Gloves'
),
(
  did,
  'Alpinestars Handske SMX-1 Air v2 Svart M',
  '694-3570518-10-2',
  'Duell AB',
  0,
  1150,
  'Gloves'
),
(
  did,
  'Alpinestars Handske SMX-1 Air v2 Svart 2XL',
  '694-3570518-10-5',
  'Duell AB',
  0,
  1150,
  'Gloves'
)
ON CONFLICT (article_number, dealership_id) DO NOTHING;


-- ─── 4. INSERT ACCESSORIES (from Shoei delivery note) ────────────────────────

INSERT INTO accessories (
  dealership_id, name, article_number, supplier, stock, price, category
) VALUES
(
  did,
  'Shoei GT-AIR3 Matt Black XL',
  '11200116',
  'Shoei Distribution GmbH',
  0,
  0,
  'Helmet'
),
(
  did,
  'SENA SRL3 (NEO3/GTA3/JCR3)',
  '21010040',
  'Shoei Distribution GmbH',
  0,
  0,
  'Helmet Accessory'
)
ON CONFLICT (article_number, dealership_id) DO NOTHING;

RAISE NOTICE 'Seed completed for dealership: %', did;

END $$;
