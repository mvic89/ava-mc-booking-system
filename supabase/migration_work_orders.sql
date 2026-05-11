-- ─── Service Module: work_orders, work_order_tasks, work_order_parts, tech_time_entries ───

-- ── work_orders ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
  id              BIGSERIAL PRIMARY KEY,
  dealership_id   UUID        NOT NULL,
  booking_id      BIGINT      REFERENCES service_bookings(id) ON DELETE SET NULL,
  customer_id     BIGINT      REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   TEXT        NOT NULL DEFAULT '',
  customer_phone  TEXT        NOT NULL DEFAULT '',
  customer_email  TEXT,
  vehicle_id      BIGINT,
  vehicle_name    TEXT        NOT NULL DEFAULT '',
  plate           TEXT        NOT NULL DEFAULT '',
  vin             TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'created',
  priority        TEXT        NOT NULL DEFAULT 'normal',
  assigned_tech   TEXT        NOT NULL DEFAULT '',
  description     TEXT        NOT NULL DEFAULT '',
  internal_notes  TEXT        NOT NULL DEFAULT '',
  mileage         INTEGER,
  labor_rate      NUMERIC(10,2) NOT NULL DEFAULT 850,
  parts_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
  invoice_id      TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_status_check') THEN
    ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check
      CHECK (status IN ('created','in_progress','waiting_parts','ready','completed','invoiced'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_priority_check') THEN
    ALTER TABLE work_orders ADD CONSTRAINT work_orders_priority_check
      CHECK (priority IN ('low','normal','high','urgent'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS work_orders_dealership_idx ON work_orders (dealership_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS work_orders_customer_idx   ON work_orders (customer_id);

-- ── work_order_tasks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_order_tasks (
  id             BIGSERIAL PRIMARY KEY,
  dealership_id  UUID      NOT NULL,
  work_order_id  BIGINT    NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  title          TEXT      NOT NULL,
  description    TEXT      NOT NULL DEFAULT '',
  estimated_hrs  NUMERIC(6,2) NOT NULL DEFAULT 0,
  actual_hrs     NUMERIC(6,2) NOT NULL DEFAULT 0,
  tech_name      TEXT      NOT NULL DEFAULT '',
  status         TEXT      NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_tasks_status_check') THEN
    ALTER TABLE work_order_tasks ADD CONSTRAINT work_order_tasks_status_check
      CHECK (status IN ('pending','in_progress','done'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS work_order_tasks_order_idx ON work_order_tasks (work_order_id);

-- ── work_order_parts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_order_parts (
  id                BIGSERIAL PRIMARY KEY,
  dealership_id     UUID      NOT NULL,
  work_order_id     BIGINT    NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  part_number       TEXT      NOT NULL DEFAULT '',
  name              TEXT      NOT NULL,
  quantity          INTEGER   NOT NULL DEFAULT 1,
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            TEXT      NOT NULL DEFAULT 'needed',
  purchase_order_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_parts_status_check') THEN
    ALTER TABLE work_order_parts ADD CONSTRAINT work_order_parts_status_check
      CHECK (status IN ('needed','reserved','ordered','received','used'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS work_order_parts_order_idx ON work_order_parts (work_order_id);

-- ── tech_time_entries ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tech_time_entries (
  id              BIGSERIAL PRIMARY KEY,
  dealership_id   UUID      NOT NULL,
  work_order_id   BIGINT    NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  task_id         BIGINT    REFERENCES work_order_tasks(id) ON DELETE SET NULL,
  tech_name       TEXT      NOT NULL DEFAULT '',
  clocked_in_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  clocked_out_at  TIMESTAMPTZ,
  duration_min    INTEGER,
  billable        BOOLEAN   NOT NULL DEFAULT true,
  notes           TEXT      NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tech_time_entries_order_idx ON tech_time_entries (work_order_id);
CREATE INDEX IF NOT EXISTS tech_time_entries_tech_idx  ON tech_time_entries (dealership_id, tech_name, clocked_in_at DESC);

-- ── RLS: service staff can read their own dealership's records ────────────────
ALTER TABLE work_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_tasks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_parts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_time_entries ENABLE ROW LEVEL SECURITY;

-- Service-role (used by the API) bypasses RLS automatically.
-- Authenticated users: allow read/write if the dealership matches their session.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_orders' AND policyname='work_orders_dealership') THEN
    CREATE POLICY work_orders_dealership ON work_orders
      USING (dealership_id::text = current_setting('app.dealership_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_order_tasks' AND policyname='work_order_tasks_dealership') THEN
    CREATE POLICY work_order_tasks_dealership ON work_order_tasks
      USING (dealership_id::text = current_setting('app.dealership_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_order_parts' AND policyname='work_order_parts_dealership') THEN
    CREATE POLICY work_order_parts_dealership ON work_order_parts
      USING (dealership_id::text = current_setting('app.dealership_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tech_time_entries' AND policyname='tech_time_entries_dealership') THEN
    CREATE POLICY tech_time_entries_dealership ON tech_time_entries
      USING (dealership_id::text = current_setting('app.dealership_id', true));
  END IF;
END $$;
