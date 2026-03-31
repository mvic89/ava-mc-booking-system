-- ============================================================
-- AVA MC BOOKING SYSTEM — COMPLETE SUPABASE SCHEMA
-- Run this entire file in Supabase Dashboard → SQL Editor
-- ============================================================
-- Tables already in Supabase (created earlier):
--   webhook_events, accessories, spare_parts, vendors,
--   motorcycles, purchase_orders, po_line_items
-- This file creates ALL remaining tables, adds missing columns
-- to existing tables, sets up foreign keys, indexes, RLS,
-- Realtime subscriptions, and automatic triggers.
-- ============================================================

-- ============================================================
-- UTILITY FUNCTION — auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 1. DEALERSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS dealerships (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  org_nr       TEXT,
  address      TEXT,
  postal_code  TEXT,
  city         TEXT,
  phone        TEXT,
  email        TEXT,
  website      TEXT,
  logo_url     TEXT,
  plan         TEXT        DEFAULT 'professional',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trigger_updated_at_dealerships
  BEFORE UPDATE ON dealerships FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 2. STAFF USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   UUID        REFERENCES dealerships(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  email           TEXT        NOT NULL UNIQUE,
  role            TEXT        NOT NULL DEFAULT 'sales'
                              CHECK (role IN ('admin','sales','service')),
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('active','inactive','pending')),
  personal_number TEXT        DEFAULT '',
  bankid_verified BOOLEAN     DEFAULT false,
  last_login      TIMESTAMPTZ,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_email           ON staff_users(email);
CREATE INDEX IF NOT EXISTS idx_staff_personal_number ON staff_users(personal_number);
CREATE TRIGGER trigger_updated_at_staff_users
  BEFORE UPDATE ON staff_users FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 3. CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id                 BIGSERIAL   PRIMARY KEY,
  first_name         TEXT        NOT NULL,
  last_name          TEXT        NOT NULL,
  personnummer       TEXT        UNIQUE,
  email              TEXT,
  phone              TEXT,
  address            TEXT,
  postal_code        TEXT,
  city               TEXT,
  birth_date         TEXT,
  gender             TEXT        CHECK (gender IN ('Man','Kvinna','M','F')),
  source             TEXT        DEFAULT 'Manual'
                                 CHECK (source IN ('BankID','Manual','Folkbokföring')),
  tag                TEXT        DEFAULT 'New'
                                 CHECK (tag IN ('VIP','Active','New','Inactive')),
  bankid_verified    BOOLEAN     DEFAULT false,
  protected_identity BOOLEAN     DEFAULT false,
  lifetime_value     NUMERIC(12,2) DEFAULT 0,
  last_activity      TIMESTAMPTZ DEFAULT NOW(),
  customer_since     TIMESTAMPTZ DEFAULT NOW(),
  -- BankID verification data
  bankid_issue_date  TEXT,
  bankid_signature   TEXT,
  bankid_ocsp        TEXT,
  last_bankid_auth   TIMESTAMPTZ,
  risk_level         TEXT        DEFAULT 'low'
                                 CHECK (risk_level IN ('low','moderate','high')),
  -- Population register (Roaring.io)
  citizenship        TEXT,
  deceased           BOOLEAN     DEFAULT false,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_personnummer   ON customers(personnummer);
CREATE INDEX IF NOT EXISTS idx_customers_email          ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_tag            ON customers(tag);
CREATE INDEX IF NOT EXISTS idx_customers_last_activity  ON customers(last_activity DESC);
CREATE TRIGGER trigger_updated_at_customers
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 4. CUSTOMER VEHICLES  (bikes they own)
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_vehicles (
  id             BIGSERIAL   PRIMARY KEY,
  customer_id    BIGINT      REFERENCES customers(id)   ON DELETE CASCADE,
  motorcycle_id  TEXT,                                    -- ref to motorcycles.id if in inventory
  name           TEXT        NOT NULL,
  year           INT,
  plate          TEXT,
  vin            TEXT,
  color          TEXT,
  status         TEXT        DEFAULT 'owned'
                             CHECK (status IN ('owned','service','sold','traded-in')),
  purchase_date  DATE,
  purchase_price NUMERIC(12,2),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_vehicles_customer ON customer_vehicles(customer_id);
CREATE TRIGGER trigger_updated_at_customer_vehicles
  BEFORE UPDATE ON customer_vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 5. CUSTOMER BANKID LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_bankid_logs (
  id              BIGSERIAL   PRIMARY KEY,
  customer_id     BIGINT      REFERENCES customers(id) ON DELETE CASCADE,
  action          TEXT        NOT NULL,  -- 'auth','sign_agreement','verify_identity'
  status          TEXT        NOT NULL   CHECK (status IN ('success','failed','pending')),
  personal_number TEXT,
  ip_address      TEXT,
  order_ref       TEXT,
  signature       TEXT,
  risk_level      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bankid_logs_customer ON customer_bankid_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_bankid_logs_created  ON customer_bankid_logs(created_at DESC);


-- ============================================================
-- 6. TRADE-INS
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_ins (
  id              BIGSERIAL     PRIMARY KEY,
  customer_id     BIGINT        REFERENCES customers(id) ON DELETE SET NULL,
  lead_id         BIGINT,                                 -- will ref leads(id) after leads table created
  name            TEXT          NOT NULL,
  vin             TEXT,
  year            INT,
  mileage         INT,
  color           TEXT,
  condition       TEXT          DEFAULT 'good'
                                CHECK (condition IN ('excellent','good','fair','poor')),
  estimated_value NUMERIC(12,2) DEFAULT 0,
  agreed_value    NUMERIC(12,2) DEFAULT 0,
  notes           TEXT,
  status          TEXT          DEFAULT 'pending'
                                CHECK (status IN ('pending','appraised','accepted','completed')),
  motorcycle_id   TEXT,                                   -- if added back to inventory after trade-in
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trade_ins_customer ON trade_ins(customer_id);
CREATE TRIGGER trigger_updated_at_trade_ins
  BEFORE UPDATE ON trade_ins FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 7. ALTER MOTORCYCLES — add status, sale tracking, category
-- ============================================================
ALTER TABLE motorcycles
  ADD COLUMN IF NOT EXISTS status     TEXT        NOT NULL DEFAULT 'available'
                                                  CHECK (status IN ('available','reserved','sold','service','demo')),
  ADD COLUMN IF NOT EXISTS sold_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sold_to    BIGINT      REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category   TEXT        DEFAULT 'New'
                                                  CHECK (category IN ('New','Trade-In','Commission','Used')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_motorcycles_status ON motorcycles(status);
CREATE INDEX IF NOT EXISTS idx_motorcycles_vin    ON motorcycles(vin);
CREATE TRIGGER trigger_updated_at_motorcycles
  BEFORE UPDATE ON motorcycles FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 8. LEADS  (sales pipeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id              BIGSERIAL     PRIMARY KEY,
  customer_id     BIGINT        REFERENCES customers(id)   ON DELETE SET NULL,
  assigned_to     UUID          REFERENCES staff_users(id) ON DELETE SET NULL,
  motorcycle_id   TEXT,                                    -- ref to motorcycles.id
  bike            TEXT          NOT NULL DEFAULT '',
  value           NUMERIC(12,2) DEFAULT 0,
  stage           TEXT          NOT NULL DEFAULT 'new'
                                CHECK (stage IN ('new','contacted','testride','negotiating','pending_payment','closed','lost')),
  lead_status     TEXT          NOT NULL DEFAULT 'warm'
                                CHECK (lead_status IN ('hot','warm','cold')),
  source          TEXT          DEFAULT 'BankID'
                                CHECK (source IN ('BankID','Manual','Phone','Walk-in','Online')),
  -- Customer snapshot (from form)
  name            TEXT          NOT NULL DEFAULT '',
  personnummer    TEXT,
  address         TEXT,
  city            TEXT,
  email           TEXT,
  phone           TEXT,
  interest        TEXT,
  notes           TEXT,
  -- Timestamps
  test_ride_date  TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  lost_reason     TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_customer ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage    ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created  ON leads(created_at DESC);
-- Now add the FK from trade_ins.lead_id
ALTER TABLE trade_ins ADD CONSTRAINT fk_trade_in_lead
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
CREATE TRIGGER trigger_updated_at_leads
  BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 9. AGREEMENTS  (purchase contracts)
-- ============================================================
CREATE TABLE IF NOT EXISTS agreements (
  id                 BIGSERIAL     PRIMARY KEY,
  agreement_number   TEXT          NOT NULL UNIQUE,  -- AGR-YYYY-NNNN
  lead_id            BIGINT        REFERENCES leads(id)      ON DELETE SET NULL,
  customer_id        BIGINT        REFERENCES customers(id)  ON DELETE SET NULL,
  motorcycle_id      TEXT,
  -- Vehicle & pricing
  vehicle            TEXT          NOT NULL DEFAULT '',
  vin                TEXT,
  accessories        TEXT          DEFAULT '',
  accessories_price  NUMERIC(12,2) DEFAULT 0,
  base_price         NUMERIC(12,2) DEFAULT 0,
  trade_in_credit    NUMERIC(12,2) DEFAULT 0,
  total_price        NUMERIC(12,2) DEFAULT 0,
  vat_amount         NUMERIC(12,2) DEFAULT 0,
  -- Financing
  financing_months   INT           DEFAULT 36,
  financing_monthly  NUMERIC(12,2) DEFAULT 0,
  financing_apr      NUMERIC(5,2)  DEFAULT 4.9,
  total_credit_cost  NUMERIC(12,2) DEFAULT 0,
  -- Status
  status             TEXT          NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft','preview','signing','signed','payment','completed','cancelled')),
  -- Signatures (BankID)
  customer_signed_at TIMESTAMPTZ,
  dealer_signed_at   TIMESTAMPTZ,
  customer_name_signed TEXT,
  customer_pn_signed   TEXT,
  dealer_name_signed   TEXT,
  dealer_pn_signed     TEXT,
  -- Seller snapshot at signing time
  seller_name        TEXT,
  seller_org_nr      TEXT,
  seller_city        TEXT,
  -- Trade-in
  trade_in_id        BIGINT        REFERENCES trade_ins(id)  ON DELETE SET NULL,
  created_at         TIMESTAMPTZ   DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agreements_lead     ON agreements(lead_id);
CREATE INDEX IF NOT EXISTS idx_agreements_customer ON agreements(customer_id);
CREATE INDEX IF NOT EXISTS idx_agreements_status   ON agreements(status);
CREATE INDEX IF NOT EXISTS idx_agreements_number   ON agreements(agreement_number);
CREATE TRIGGER trigger_updated_at_agreements
  BEFORE UPDATE ON agreements FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 10. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id                BIGSERIAL     PRIMARY KEY,
  agreement_id      BIGINT        REFERENCES agreements(id)  ON DELETE SET NULL,
  lead_id           BIGINT        REFERENCES leads(id)       ON DELETE SET NULL,
  customer_id       BIGINT        REFERENCES customers(id)   ON DELETE SET NULL,
  invoice_id        TEXT,                                     -- references invoices.id (TEXT PK)
  -- Payment details
  amount            NUMERIC(12,2) NOT NULL,
  currency          TEXT          DEFAULT 'SEK',
  method            TEXT          NOT NULL,                   -- 'swish','klarna','svea','card',…
  status            TEXT          NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','processing','confirmed','failed','refunded')),
  -- PSP reference
  provider          TEXT,                                     -- 'swish','stripe','adyen',…
  provider_ref      TEXT,
  -- Financing-specific
  financing_bank    TEXT,                                     -- 'svea','santander'
  financing_app_id  TEXT,
  financing_status  TEXT          CHECK (financing_status IN ('approved','pending','denied')),
  monthly_amount    NUMERIC(12,2),
  apr               NUMERIC(5,2),
  term_months       INT,
  payout_status     TEXT          DEFAULT 'awaiting'
                                  CHECK (payout_status IN ('awaiting','paid_out')),
  payout_date       TIMESTAMPTZ,
  dealer_commission NUMERIC(12,2) DEFAULT 0,
  -- Traceability
  webhook_event_id  BIGINT        REFERENCES webhook_events(id) ON DELETE SET NULL,
  confirmed_at      TIMESTAMPTZ,
  failed_reason     TEXT,
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_agreement ON payments(agreement_id);
CREATE INDEX IF NOT EXISTS idx_payments_status    ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created   ON payments(created_at DESC);
CREATE TRIGGER trigger_updated_at_payments
  BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 11. INVOICES  (sales invoices)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT          PRIMARY KEY,                  -- INV-YYYY-NNN
  lead_id         BIGINT        REFERENCES leads(id)       ON DELETE SET NULL,
  agreement_id    BIGINT        REFERENCES agreements(id)  ON DELETE SET NULL,
  customer_id     BIGINT        REFERENCES customers(id)   ON DELETE SET NULL,
  payment_id      BIGINT        REFERENCES payments(id)    ON DELETE SET NULL,
  customer_name   TEXT          NOT NULL,
  vehicle         TEXT          NOT NULL,
  agreement_ref   TEXT,
  total_amount    NUMERIC(12,2) NOT NULL,
  vat_amount      NUMERIC(12,2) NOT NULL,
  net_amount      NUMERIC(12,2) NOT NULL,
  payment_method  TEXT          DEFAULT '',
  status          TEXT          NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('draft','pending','paid','overdue','cancelled')),
  issue_date      TIMESTAMPTZ   DEFAULT NOW(),
  due_date        TIMESTAMPTZ,
  paid_date       TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_lead     ON invoices(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issued   ON invoices(issue_date DESC);
CREATE TRIGGER trigger_updated_at_invoices
  BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Add FK from payments.invoice_id now that invoices table exists
ALTER TABLE payments ADD CONSTRAINT fk_payment_invoice
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;


-- ============================================================
-- 12. DELIVERIES
-- ============================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id                    BIGSERIAL   PRIMARY KEY,
  agreement_id          BIGINT      REFERENCES agreements(id)  ON DELETE SET NULL,
  lead_id               BIGINT      REFERENCES leads(id)       ON DELETE SET NULL,
  customer_id           BIGINT      REFERENCES customers(id)   ON DELETE SET NULL,
  motorcycle_id         TEXT,
  scheduled_date        DATE,
  actual_date           DATE,
  location              TEXT,
  status                TEXT        NOT NULL DEFAULT 'scheduled'
                                    CHECK (status IN ('scheduled','ready','delivered','cancelled')),
  checklist_done        BOOLEAN     DEFAULT false,
  checklist_items       JSONB       DEFAULT '[]',
  delivery_by           UUID        REFERENCES staff_users(id) ON DELETE SET NULL,
  registration_nr       TEXT,
  registration_status   TEXT        DEFAULT 'pending'
                                    CHECK (registration_status IN ('pending','initiated','complete')),
  customer_signed       BOOLEAN     DEFAULT false,
  customer_signed_at    TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_agreement ON deliveries(agreement_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status    ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_date      ON deliveries(scheduled_date);
CREATE TRIGGER trigger_updated_at_deliveries
  BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 13. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID        REFERENCES staff_users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL
                            CHECK (type IN ('lead','agreement','payment','customer','system','delivery','inventory')),
  title         TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  href          TEXT,
  read          BOOLEAN     DEFAULT false,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(staff_user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);


-- ============================================================
-- 14. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGSERIAL   PRIMARY KEY,
  staff_user_id UUID        REFERENCES staff_users(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,  -- 'CREATE','UPDATE','DELETE','LOGIN','SIGN','PAYMENT'
  entity        TEXT        NOT NULL,  -- 'lead','agreement','invoice','customer',…
  entity_id     TEXT,
  old_data      JSONB,
  new_data      JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity  ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_staff   ON audit_logs(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);


-- ============================================================
-- 15. TIMELINE EVENTS  (per-entity activity feed)
-- ============================================================
CREATE TABLE IF NOT EXISTS timeline_events (
  id            BIGSERIAL   PRIMARY KEY,
  entity        TEXT        NOT NULL,  -- 'lead','customer','agreement','delivery'
  entity_id     TEXT        NOT NULL,
  event         TEXT        NOT NULL,
  detail        TEXT,
  staff_user_id UUID        REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timeline_entity  ON timeline_events(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created ON timeline_events(created_at DESC);


-- ============================================================
-- 16. PAYMENT CONFIGS  (dealer-level provider settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  provider_id   TEXT NOT NULL,   -- 'klarna','svea','adyen','swish',…
  active        BOOLEAN DEFAULT false,
  config        JSONB   DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dealership_id, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_configs_dealer ON payment_configs(dealership_id);
CREATE TRIGGER trigger_updated_at_payment_configs
  BEFORE UPDATE ON payment_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- TRIGGERS — automatic cascading business logic
-- ============================================================

-- A) Payment confirmed → mark invoice paid + motorcycle sold + lead closed
CREATE OR REPLACE FUNCTION fn_payment_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  v_agreement RECORD;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN

    -- Mark invoice paid
    UPDATE invoices
       SET status    = 'paid',
           paid_date = NOW()
     WHERE id = NEW.invoice_id;

    -- Fetch agreement
    SELECT * INTO v_agreement FROM agreements WHERE id = NEW.agreement_id;

    IF FOUND THEN
      -- Mark agreement completed
      UPDATE agreements SET status = 'completed' WHERE id = v_agreement.id AND status != 'completed';

      -- Mark motorcycle sold
      UPDATE motorcycles
         SET status  = 'sold',
             sold_at = NOW(),
             sold_to = NEW.customer_id
       WHERE id = v_agreement.motorcycle_id AND status != 'sold';

      -- Close the lead
      UPDATE leads
         SET stage     = 'closed',
             closed_at = NOW()
       WHERE id = v_agreement.lead_id AND stage NOT IN ('closed','lost');

      -- Add customer vehicle record
      INSERT INTO customer_vehicles (customer_id, motorcycle_id, name, vin, color, status, purchase_date, purchase_price)
        SELECT NEW.customer_id,
               v_agreement.motorcycle_id,
               v_agreement.vehicle,
               v_agreement.vin,
               NULL,
               'owned',
               NOW()::DATE,
               v_agreement.total_price
        WHERE NEW.customer_id IS NOT NULL
        ON CONFLICT DO NOTHING;

      -- Timeline entry
      INSERT INTO timeline_events (entity, entity_id, event, detail)
        VALUES ('agreement', v_agreement.id::TEXT, 'Payment confirmed — agreement completed',
                'Via ' || COALESCE(NEW.provider, NEW.method, 'unknown'));
    END IF;

    -- Update customer lifetime_value
    UPDATE customers
       SET lifetime_value = lifetime_value + NEW.amount,
           last_activity  = NOW()
     WHERE id = NEW.customer_id;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_payment_confirmed
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed')
  EXECUTE FUNCTION fn_payment_confirmed();


-- B) Agreement fully signed → auto-create delivery, reserve motorcycle, advance lead
CREATE OR REPLACE FUNCTION fn_agreement_signed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') THEN

    -- Create delivery record
    INSERT INTO deliveries (agreement_id, lead_id, customer_id, motorcycle_id, status)
    VALUES (NEW.id, NEW.lead_id, NEW.customer_id, NEW.motorcycle_id, 'scheduled')
    ON CONFLICT DO NOTHING;

    -- Reserve motorcycle
    UPDATE motorcycles
       SET status = 'reserved'
     WHERE id = NEW.motorcycle_id AND status = 'available';

    -- Advance lead to negotiating (payment selection)
    UPDATE leads
       SET stage = 'negotiating'
     WHERE id = NEW.lead_id AND stage NOT IN ('negotiating','closed','lost');

    -- Log BankID signature for customer
    IF NEW.customer_id IS NOT NULL THEN
      INSERT INTO customer_bankid_logs (customer_id, action, status, personal_number)
      VALUES (NEW.customer_id, 'sign_agreement', 'success', NEW.customer_pn_signed);
    END IF;

    -- Timeline
    INSERT INTO timeline_events (entity, entity_id, event)
    VALUES ('agreement', NEW.id::TEXT, 'Agreement signed by both parties');

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_agreement_signed
  AFTER UPDATE ON agreements
  FOR EACH ROW
  WHEN (NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed')
  EXECUTE FUNCTION fn_agreement_signed();


-- C) Lead stage change → timeline entry
CREATE OR REPLACE FUNCTION fn_lead_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO timeline_events (entity, entity_id, event)
    VALUES ('lead', NEW.id::TEXT, 'Stage: ' || OLD.stage || ' → ' || NEW.stage);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_lead_stage_change
  AFTER UPDATE ON leads
  FOR EACH ROW
  WHEN (NEW.stage IS DISTINCT FROM OLD.stage)
  EXECUTE FUNCTION fn_lead_stage_change();


-- D) New lead → timeline entry
CREATE OR REPLACE FUNCTION fn_lead_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO timeline_events (entity, entity_id, event, detail)
  VALUES ('lead', NEW.id::TEXT, 'Lead created', COALESCE(NEW.name,'') || ' — ' || COALESCE(NEW.bike,''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_lead_created
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_lead_created();


-- E) Delivery status change → timeline entry
CREATE OR REPLACE FUNCTION fn_delivery_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO timeline_events (entity, entity_id, event)
    VALUES ('delivery', NEW.id::TEXT, 'Delivery: ' || OLD.status || ' → ' || NEW.status);
    -- If delivered, mark motorcycle as sold (in case payment was done separately)
    IF NEW.status = 'delivered' THEN
      UPDATE motorcycles SET status = 'sold', sold_at = NOW()
       WHERE id = NEW.motorcycle_id AND status IN ('available','reserved');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_delivery_status_change
  AFTER UPDATE ON deliveries
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION fn_delivery_status_change();


-- F) Invoice paid → update customer lifetime_value (fallback if no payment row)
CREATE OR REPLACE FUNCTION fn_invoice_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') AND NEW.customer_id IS NOT NULL THEN
    UPDATE customers
       SET lifetime_value = lifetime_value + NEW.total_amount,
           last_activity  = NOW()
     WHERE id = NEW.customer_id;
    INSERT INTO timeline_events (entity, entity_id, event, detail)
    VALUES ('invoice', NEW.id, 'Invoice paid', NEW.id || ' — ' || NEW.total_amount::TEXT || ' SEK');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_invoice_paid
  AFTER UPDATE ON invoices
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION fn_invoice_paid();


-- ============================================================
-- ROW LEVEL SECURITY — permissive for anon key (demo/dev)
-- Replace with auth-based policies before production.
-- ============================================================
ALTER TABLE dealerships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_vehicles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_bankid_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_ins            ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_configs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorcycles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors              ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_line_items        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
  tbl_list TEXT[] := ARRAY[
    'dealerships','staff_users','customers','customer_vehicles',
    'customer_bankid_logs','trade_ins','leads','agreements','payments',
    'invoices','deliveries','notifications','audit_logs','timeline_events',
    'payment_configs','motorcycles','accessories','spare_parts','vendors',
    'purchase_orders','po_line_items'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbl_list LOOP
    EXECUTE format(
      'DO $inner$ BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_policies WHERE tablename = %L AND policyname = %L
         ) THEN
           EXECUTE format(''CREATE POLICY allow_all ON %I FOR ALL USING (true) WITH CHECK (true)'', %L);
         END IF;
       END $inner$',
      tbl, 'allow_all', tbl, tbl
    );
  END LOOP;
END;
$$;


-- ============================================================
-- SUPABASE REALTIME — subscribe all operational tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_bankid_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE agreements;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE timeline_events;
ALTER PUBLICATION supabase_realtime ADD TABLE motorcycles;
ALTER PUBLICATION supabase_realtime ADD TABLE accessories;
ALTER PUBLICATION supabase_realtime ADD TABLE spare_parts;
ALTER PUBLICATION supabase_realtime ADD TABLE trade_ins;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_users;


-- ============================================================
-- 17. INVENTORY & PROCUREMENT RELATIONSHIPS
-- ============================================================
-- Wire vendors, motorcycles, spare_parts, accessories, and
-- purchase_orders into the rest of the schema.
--
-- IMPORTANT: Run this section ONLY after supabase/schema.sql
-- has already created the base tables. If your vendors table
-- is empty, populate it before adding FK constraints so the
-- existing vendor TEXT values can be validated.
-- ============================================================


-- ── 17a. Vendor FK on inventory tables ───────────────────────────────────────
-- motorcycles.vendor, spare_parts.vendor, accessories.vendor, and
-- purchase_orders.vendor are all plain TEXT referencing vendors.name (the PK).
-- ON UPDATE CASCADE means renaming a vendor propagates automatically.
-- ON DELETE RESTRICT prevents deleting a vendor that still has linked items.

ALTER TABLE motorcycles
  ADD CONSTRAINT IF NOT EXISTS fk_motorcycles_vendor
  FOREIGN KEY (vendor) REFERENCES vendors(name)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE spare_parts
  ADD CONSTRAINT IF NOT EXISTS fk_spare_parts_vendor
  FOREIGN KEY (vendor) REFERENCES vendors(name)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE accessories
  ADD CONSTRAINT IF NOT EXISTS fk_accessories_vendor
  FOREIGN KEY (vendor) REFERENCES vendors(name)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE purchase_orders
  ADD CONSTRAINT IF NOT EXISTS fk_purchase_orders_vendor
  FOREIGN KEY (vendor) REFERENCES vendors(name)
  ON UPDATE CASCADE ON DELETE RESTRICT;


-- ── 17b. Purchase Orders → Dealership + Staff ─────────────────────────────────
-- Who raised the PO, who approved it, and which dealership it belongs to.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS dealership_id UUID        REFERENCES dealerships(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by   UUID        REFERENCES staff_users(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by  UUID        REFERENCES staff_users(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS received_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor      ON purchase_orders(vendor);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_dealership  ON purchase_orders(dealership_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by  ON purchase_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status      ON purchase_orders(status);

CREATE TRIGGER trigger_updated_at_purchase_orders
  BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 17c. PO Line Items — inventory type discriminator ────────────────────────
-- inventory_id is a polymorphic reference (motorcycles, spare_parts, or
-- accessories all share TEXT PKs). Adding inventory_type makes it unambiguous
-- and enables application-level JOIN routing.

ALTER TABLE po_line_items
  ADD COLUMN IF NOT EXISTS inventory_type TEXT
    CHECK (inventory_type IN ('motorcycle', 'spare_part', 'accessory'));

CREATE INDEX IF NOT EXISTS idx_po_line_items_po           ON po_line_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_inventory    ON po_line_items(inventory_id);


-- ── 17d. Agreement ↔ Accessories  (normalized line items) ────────────────────
-- agreements.accessories is a free-text snapshot kept for display.
-- This table is the relational version: each row = one accessory on one agreement.
-- line_total is computed automatically (quantity × unit_price).

CREATE TABLE IF NOT EXISTS agreement_accessories (
  id            BIGSERIAL     PRIMARY KEY,
  agreement_id  BIGINT        NOT NULL REFERENCES agreements(id)  ON DELETE CASCADE,
  accessory_id  TEXT          NOT NULL REFERENCES accessories(id) ON DELETE RESTRICT,
  quantity      INT           NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total    NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes         TEXT,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agreement_acc_agreement ON agreement_accessories(agreement_id);
CREATE INDEX IF NOT EXISTS idx_agreement_acc_accessory ON agreement_accessories(accessory_id);

ALTER TABLE agreement_accessories ENABLE ROW LEVEL SECURITY;
DO $rls$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agreement_accessories' AND policyname = 'allow_all'
  ) THEN
    CREATE POLICY allow_all ON agreement_accessories FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $rls$;


-- ── 17e. Motorcycle ↔ Accessories  (compatibility catalogue) ─────────────────
-- Tracks which accessories are compatible with which motorcycle models.
-- Useful for the agreement form (auto-suggest accessories when a bike is chosen).

CREATE TABLE IF NOT EXISTS motorcycle_accessories (
  motorcycle_id  TEXT  NOT NULL REFERENCES motorcycles(id)  ON DELETE CASCADE,
  accessory_id   TEXT  NOT NULL REFERENCES accessories(id)  ON DELETE CASCADE,
  PRIMARY KEY (motorcycle_id, accessory_id)
);

ALTER TABLE motorcycle_accessories ENABLE ROW LEVEL SECURITY;
DO $rls2$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'motorcycle_accessories' AND policyname = 'allow_all'
  ) THEN
    CREATE POLICY allow_all ON motorcycle_accessories FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $rls2$;


-- ── 17f. Realtime for procurement tables ──────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE vendors;
ALTER PUBLICATION supabase_realtime ADD TABLE po_line_items;
ALTER PUBLICATION supabase_realtime ADD TABLE agreement_accessories;
ALTER PUBLICATION supabase_realtime ADD TABLE motorcycle_accessories;


-- ============================================================
-- SUMMARY
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ AVA MC Schema applied:';
  RAISE NOTICE '  Tables: dealerships, staff_users, customers, customer_vehicles,';
  RAISE NOTICE '          customer_bankid_logs, trade_ins, leads, agreements,';
  RAISE NOTICE '          payments, invoices, deliveries, notifications,';
  RAISE NOTICE '          audit_logs, timeline_events, payment_configs';
  RAISE NOTICE '  New tables: agreement_accessories, motorcycle_accessories';
  RAISE NOTICE '  Existing tables updated: motorcycles (+status, sold_at, sold_to, category)';
  RAISE NOTICE '  Existing tables updated: purchase_orders (+dealership_id, created_by,';
  RAISE NOTICE '                           approved_by, received_at, created_at, updated_at)';
  RAISE NOTICE '  Existing tables updated: po_line_items (+inventory_type)';
  RAISE NOTICE '  FK constraints added: motorcycles/spare_parts/accessories/purchase_orders → vendors';
  RAISE NOTICE '  Triggers: payment_confirmed, agreement_signed, lead_stage_change,';
  RAISE NOTICE '            lead_created, delivery_status_change, invoice_paid';
  RAISE NOTICE '  Realtime: ALL operational tables subscribed';
  RAISE NOTICE '  RLS: permissive policies enabled on all tables';
END $$;


-- ── 18. Multi-Tenant Data Isolation ──────────────────────────────────────────
-- Every row in every core data table must belong to exactly one dealership.
-- The app always filters .eq('dealership_id', <uuid>) so no dealer ever sees
-- another dealer's customers, leads, or invoices.
-- Existing rows that pre-date this column will have dealership_id = NULL and
-- will be invisible to all dealer queries (which require a non-null match).

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_customers_dealership ON customers(dealership_id);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_leads_dealership ON leads(dealership_id);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_invoices_dealership ON invoices(dealership_id);

ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_agreements_dealership ON agreements(dealership_id);

-- ── 18b. RLS isolation policies ──────────────────────────────────────────────
-- The current auth model uses the anon key with no Supabase Auth JWT, so we
-- cannot use auth.uid() in policies yet.  The app layer enforces isolation via
-- getDealershipId() filtering on every query.
--
-- When Supabase Auth is integrated (future), replace the allow_all policies
-- with dealership-scoped ones such as:
--
--   DROP POLICY allow_all ON customers;
--   CREATE POLICY customers_isolation ON customers
--     FOR ALL USING (dealership_id::text = current_setting('app.dealership_id', true));
--
-- Until then, keep allow_all so the anon-key client can operate normally.
-- App-layer isolation is enforced by always including .eq('dealership_id', id).

DO $$ BEGIN
  RAISE NOTICE '── Section 18 applied ──────────────────────────────────────';
  RAISE NOTICE '  dealership_id added to: customers, leads, invoices, agreements';
  RAISE NOTICE '  Indexes created for fast per-dealer queries';
  RAISE NOTICE '  App-layer tenant isolation active via getDealershipId()';
END $$;

-- ── 19. Inventory & Purchase-Order Tenant Isolation ───────────────────────────
-- Inventory items (motorcycles, spare_parts, accessories) belong to a single
-- dealership.  Each dealer manages and sees only their own stock.
-- purchase_orders already has dealership_id (section 9); po_line_items is
-- implicitly scoped via the po_id FK.

ALTER TABLE motorcycles
  ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_motorcycles_dealership ON motorcycles(dealership_id);

ALTER TABLE spare_parts
  ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_spare_parts_dealership ON spare_parts(dealership_id);

ALTER TABLE accessories
  ADD COLUMN IF NOT EXISTS dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_accessories_dealership ON accessories(dealership_id);

DO $$ BEGIN
  RAISE NOTICE '── Section 19 applied ──────────────────────────────────────';
  RAISE NOTICE '  dealership_id added to: motorcycles, spare_parts, accessories';
  RAISE NOTICE '  purchase_orders already had dealership_id (section 9)';
  RAISE NOTICE '  po_line_items scoped via po_id FK — no column needed';
END $$;
