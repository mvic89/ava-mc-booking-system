// ─── Customer store — Supabase backing store ──────────────────────────────────

import { getSupabaseBrowser } from './supabase';
import { getDealershipId } from './tenant';

export type Tag    = 'VIP' | 'Active' | 'New' | 'Inactive';
export type Source = 'BankID' | 'Manual';

export interface Customer {
  id:                number;
  firstName:         string;
  lastName:          string;
  personnummer:      string;
  email:             string;
  phone:             string;
  address:           string;
  postalCode:        string;
  city:              string;
  birthDate:         string;
  gender:            'Man' | 'Kvinna';
  source:            Source;
  tag:               Tag;
  bankidVerified:    boolean;
  protectedIdentity: boolean;
  lifetimeValue:     number;
  lastActivity:      string;
  customerSince:     string;
  riskLevel:         string;
  citizenship:       string;
  deceased:          boolean;
  notes?:            string;
  vehicles:          number;   // computed client-side (not a DB column)
}


// ── Supabase client ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getSupabaseBrowser() as any; }

// ── Column mapping ─────────────────────────────────────────────────────────────
const MONTH_MAP: Record<string, number> = {
  Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12,
};

function parseLastActivity(s: string): string {
  if (!s || s === '—') return new Date().toISOString();
  // Try ISO / YYYY-MM-DD / any parseable date string first
  const direct = new Date(s);
  if (!isNaN(direct.getTime())) return direct.toISOString();
  // Fallback: "Mon DD" display format (e.g. "Jun 9")
  const [mon, day] = s.split(' ');
  const m = MONTH_MAP[mon ?? ''];
  const d = parseInt(day ?? '0');
  if (m && d) return new Date(2025, m - 1, d).toISOString();
  return new Date().toISOString();
}

function formatLastActivity(ts: string | null): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return '—'; }
}

function mapDbToCustomer(row: Record<string, unknown>): Customer {
  return {
    id:                row.id as number,
    firstName:         (row.first_name        as string)  ?? '',
    lastName:          (row.last_name         as string)  ?? '',
    personnummer:      (row.personnummer       as string)  ?? '',
    email:             (row.email             as string)  ?? '',
    phone:             (row.phone             as string)  ?? '',
    address:           (row.address           as string)  ?? '',
    postalCode:        (row.postal_code        as string)  ?? '',
    city:              (row.city              as string)  ?? '',
    birthDate:         (row.birth_date         as string)  ?? '',
    gender:            (row.gender            as 'Man' | 'Kvinna') ?? 'Man',
    source:            (row.source            as Source)  ?? 'Manual',
    tag:               (row.tag               as Tag)     ?? 'New',
    bankidVerified:    (row.bankid_verified    as boolean) ?? false,
    protectedIdentity: (row.protected_identity as boolean) ?? false,
    lifetimeValue:     parseFloat(String(row.lifetime_value ?? '0')),
    lastActivity:      formatLastActivity(row.last_activity as string | null),
    customerSince:     formatLastActivity(row.customer_since as string | null),
    riskLevel:         (row.risk_level        as string)  ?? 'low',
    citizenship:       (row.citizenship       as string)  ?? '',
    deceased:          (row.deceased          as boolean) ?? false,
    notes:             (row.notes             as string)  ?? undefined,
    vehicles:          (row.vehicle_count as number) ?? 0,
  };
}

function mapCustomerToDb(c: Customer, includeId = true): Record<string, unknown> {
  const row: Record<string, unknown> = {
    first_name:         c.firstName,
    last_name:          c.lastName,
    personnummer:       c.personnummer  || null,
    email:              c.email         || null,
    phone:              c.phone         || null,
    address:            c.address       || null,
    postal_code:        c.postalCode    || null,
    city:               c.city          || null,
    birth_date:         c.birthDate     || null,
    gender:             c.gender,
    source:             c.source,
    tag:                c.tag,
    bankid_verified:    c.bankidVerified,
    protected_identity: c.protectedIdentity,
    lifetime_value:     c.lifetimeValue,
    last_activity:      parseLastActivity(c.lastActivity),
    risk_level:         c.riskLevel     || 'low',
    citizenship:        c.citizenship   || null,
    deceased:           c.deceased,
    notes:              c.notes         || null,
  };
  if (includeId) row.id = c.id;
  return row;
}


// ── Read ───────────────────────────────────────────────────────────────────────

export async function getCustomers(): Promise<Customer[]> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return [];
  // Use server-side route so service-role key bypasses RLS on the customers table.
  try {
    const res = await fetch(`/api/customers/list?dealershipId=${encodeURIComponent(dealershipId)}`);
    if (!res.ok) { console.error('[customers] getCustomers HTTP', res.status); return []; }
    const json = await res.json() as { customers?: unknown[] };
    return (json.customers ?? []).map((r) => mapDbToCustomer(r as Record<string, unknown>));
  } catch (err) {
    console.error('[customers] getCustomers:', err);
    return [];
  }
}

export async function getCustomerById(id: number): Promise<Customer | undefined> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return undefined;
  // Use server-side route so service-role key bypasses RLS on the customers table.
  try {
    const res = await fetch(`/api/customers/list?dealershipId=${encodeURIComponent(dealershipId)}&id=${id}`);
    if (!res.ok) return undefined;
    const json = await res.json() as { customer?: unknown };
    if (!json.customer) return undefined;
    return mapDbToCustomer(json.customer as Record<string, unknown>);
  } catch {
    return undefined;
  }
}

// ── Write ──────────────────────────────────────────────────────────────────────

export async function saveCustomer(customer: Customer): Promise<void> {
  const dealershipId = getDealershipId();
  if (!dealershipId) { console.error('[customers] saveCustomer: no dealership context'); return; }
  const { error } = await db()
    .from('customers')
    .upsert({ ...mapCustomerToDb(customer, true), dealership_id: dealershipId });
  if (error) console.error('[customers] saveCustomer:', error.message);
}

export async function createCustomer(
  data: Omit<Customer, 'id'>,
): Promise<Customer> {
  const dealershipId = getDealershipId();
  if (!dealershipId) throw new Error('Not authenticated: no dealership context');

  // Check for an existing customer with the same personnummer before inserting
  if (data.personnummer) {
    const { data: existing } = await db()
      .from('customers')
      .select('id, first_name, last_name')
      .eq('personnummer', data.personnummer)
      .eq('dealership_id', dealershipId)
      .maybeSingle();
    if (existing) {
      throw new Error(`DUPLICATE_CUSTOMER:${existing.id}:${existing.first_name} ${existing.last_name}`);
    }
  }

  const row = { ...mapCustomerToDb({ ...data, id: 0 }, false), dealership_id: dealershipId };
  const { data: created, error } = await db()
    .from('customers')
    .insert(row)
    .select()
    .single();
  if (error) {
    // Catch DB-level unique constraint violation as a safety net
    if (error.code === '23505') {
      throw new Error('DUPLICATE_CUSTOMER:unknown:');
    }
    throw new Error(error.message);
  }
  if (!created) throw new Error('createCustomer failed');
  return mapDbToCustomer(created as Record<string, unknown>);
}

export async function deleteCustomers(ids: number[]): Promise<void> {
  const dealershipId = getDealershipId();
  if (!dealershipId || ids.length === 0) return;
  // Use server-side route so service-role key bypasses RLS on the customers table.
  const res = await fetch('/api/customers/delete', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ dealershipId, ids }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Delete failed (${res.status})`);
  }
}
