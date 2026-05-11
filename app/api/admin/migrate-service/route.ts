import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// Full DDL as a single transaction — Supabase Management API accepts raw SQL
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS work_orders (
  id              BIGSERIAL PRIMARY KEY,
  dealership_id   UUID          NOT NULL,
  booking_id      BIGINT,
  customer_id     BIGINT,
  customer_name   TEXT          NOT NULL DEFAULT '',
  customer_phone  TEXT          NOT NULL DEFAULT '',
  customer_email  TEXT,
  vehicle_id      BIGINT,
  vehicle_name    TEXT          NOT NULL DEFAULT '',
  plate           TEXT          NOT NULL DEFAULT '',
  vin             TEXT          NOT NULL DEFAULT '',
  status          TEXT          NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created','in_progress','waiting_parts','ready','completed','invoiced')),
  priority        TEXT          NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('low','normal','high','urgent')),
  assigned_tech   TEXT          NOT NULL DEFAULT '',
  description     TEXT          NOT NULL DEFAULT '',
  internal_notes  TEXT          NOT NULL DEFAULT '',
  mileage         INTEGER,
  labor_rate      NUMERIC(10,2) NOT NULL DEFAULT 850,
  parts_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
  invoice_id      TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_order_tasks (
  id             BIGSERIAL PRIMARY KEY,
  dealership_id  UUID         NOT NULL,
  work_order_id  BIGINT       NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  title          TEXT         NOT NULL,
  description    TEXT         NOT NULL DEFAULT '',
  estimated_hrs  NUMERIC(6,2) NOT NULL DEFAULT 0,
  actual_hrs     NUMERIC(6,2) NOT NULL DEFAULT 0,
  tech_name      TEXT         NOT NULL DEFAULT '',
  status         TEXT         NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','in_progress','done')),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_order_parts (
  id                BIGSERIAL    PRIMARY KEY,
  dealership_id     UUID         NOT NULL,
  work_order_id     BIGINT       NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  part_number       TEXT         NOT NULL DEFAULT '',
  name              TEXT         NOT NULL,
  quantity          INTEGER      NOT NULL DEFAULT 1,
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            TEXT         NOT NULL DEFAULT 'needed'
                    CHECK (status IN ('needed','reserved','ordered','received','used')),
  purchase_order_id TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tech_time_entries (
  id              BIGSERIAL    PRIMARY KEY,
  dealership_id   UUID         NOT NULL,
  work_order_id   BIGINT       NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  task_id         BIGINT       REFERENCES work_order_tasks(id) ON DELETE SET NULL,
  tech_name       TEXT         NOT NULL DEFAULT '',
  clocked_in_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  clocked_out_at  TIMESTAMPTZ,
  duration_min    INTEGER,
  billable        BOOLEAN      NOT NULL DEFAULT true,
  notes           TEXT         NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_orders_dealership_idx  ON work_orders (dealership_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS work_orders_customer_idx    ON work_orders (customer_id);
CREATE INDEX IF NOT EXISTS work_order_tasks_order_idx  ON work_order_tasks (work_order_id);
CREATE INDEX IF NOT EXISTS work_order_parts_order_idx  ON work_order_parts (work_order_id);
CREATE INDEX IF NOT EXISTS tech_time_entries_order_idx ON tech_time_entries (work_order_id);
`;

// GET — check which tables exist
export async function GET() {
  const tables = ['work_orders', 'work_order_tasks', 'work_order_parts', 'tech_time_entries'];
  const status: Record<string, boolean> = {};
  for (const t of tables) {
    const { error } = await sb().from(t).select('id').limit(1).maybeSingle();
    status[t] = !error || !error.message?.includes('does not exist');
  }
  const allReady = Object.values(status).every(Boolean);
  return NextResponse.json({ tables: status, allReady });
}

// POST — run the migration via Supabase Management API
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Extract project ref from URL: https://XXXX.supabase.co
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

  // Try Supabase Management API — requires service role key as bearer token
  const mgmtRes = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ query: MIGRATION_SQL }),
    },
  );

  if (mgmtRes.ok) {
    return NextResponse.json({ ok: true, method: 'management_api' });
  }

  const mgmtError = await mgmtRes.text();

  // Management API failed (needs PAT, not service role key).
  // Return the SQL so the caller can show it to the user.
  return NextResponse.json({
    ok:     false,
    method: 'manual_required',
    error:  `Management API returned ${mgmtRes.status}: ${mgmtError}`,
    sql:    MIGRATION_SQL,
  }, { status: 422 });
}
