// ─── Lead store — Supabase backing store ──────────────────────────────────────
import { getSupabaseBrowser } from './supabase';
import { getDealershipId } from './tenant';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return getSupabaseBrowser() as any; }

export type Status = 'hot' | 'warm' | 'cold';
export type Stage  = 'new' | 'contacted' | 'testride' | 'negotiating' | 'pending_payment' | 'closed';

export interface Lead {
  id:       number;
  name:     string;
  bike:     string;
  value:    string;   // display string e.g. "150k kr"
  rawValue: number;   // numeric kr — use this for all calculations
  time:     string;   // display string e.g. "2h ago"
  status:   Status;
  verified: boolean;
  stage:    Stage;
  initials: string;
  email:    string;
  phone:    string;
}

// ── Column mapping ─────────────────────────────────────────────────────────────

function formatValue(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k kr`;
  return `${n} kr`;
}

function formatTime(ts: string | null): string {
  if (!ts) return 'Just now';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
}

function mapDbToLead(row: Record<string, unknown>): Lead {
  const rawValue = parseFloat(String(row.value ?? '0')) || 0;
  return {
    id:       row.id as number,
    name:     (row.name        as string) ?? '',
    bike:     (row.bike        as string) ?? '',
    value:    formatValue(rawValue),
    rawValue,
    time:     formatTime(row.created_at as string | null),
    status:   (row.lead_status as Status) ?? 'warm',
    verified: !!(row.personnummer),
    stage:    (row.stage       as Stage)  ?? 'new',
    initials: initials((row.name as string) ?? ''),
    email:    (row.email       as string) ?? '',
    phone:    (row.phone       as string) ?? '',
  };
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function getLeads(): Promise<Lead[]> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return [];
  const { data, error } = await db()
    .from('leads')
    .select('*')
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[leads] getLeads:', error.message); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => mapDbToLead(r));
}

export async function getLeadById(id: number): Promise<Lead | undefined> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return undefined;
  const { data, error } = await db()
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('dealership_id', dealershipId)
    .single();
  if (error || !data) return undefined;
  return mapDbToLead(data as Record<string, unknown>);
}

// ── Write ──────────────────────────────────────────────────────────────────────

export interface CreateLeadInput {
  name:        string;
  bike:        string;
  value:       number;
  lead_status: Status;
  stage:       Stage;
  email:       string;
  phone:       string;
  personnummer?: string | null;
  source?:     string;
  notes?:      string;
  address?:    string | null;
  city?:       string | null;
}

export async function createLead(data: CreateLeadInput): Promise<Lead> {
  const dealershipId = getDealershipId();
  if (!dealershipId) throw new Error('Not authenticated: no dealership context');
  const { data: created, error } = await db()
    .from('leads')
    .insert({
      name:          data.name,
      bike:          data.bike,
      value:         data.value,
      lead_status:   data.lead_status,
      stage:         data.stage,
      email:         data.email        || null,
      phone:         data.phone        || null,
      personnummer:  data.personnummer || null,
      source:        data.source       ?? 'Manual',
      notes:         data.notes        || null,
      address:       data.address      || null,
      city:          data.city         || null,
      dealership_id: dealershipId,
    })
    .select()
    .single();
  if (error || !created) throw new Error(error?.message ?? 'createLead failed');
  return mapDbToLead(created as Record<string, unknown>);
}

export async function updateLeadStage(id: number, stage: Stage): Promise<void> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return;
  const { error } = await db()
    .from('leads')
    .update({ stage })
    .eq('id', id)
    .eq('dealership_id', dealershipId);
  if (error) console.error('[leads] updateLeadStage:', error.message);
}

/**
 * Advance a lead to 'negotiating' only if it is still at 'new' or 'contacted'.
 * Called when the agreement page is opened so the kanban column updates.
 */
export async function advanceLeadToNegotiating(id: number): Promise<void> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return;
  await db()
    .from('leads')
    .update({ stage: 'negotiating' })
    .eq('id', id)
    .eq('dealership_id', dealershipId)
    .in('stage', ['new', 'contacted']);   // never regress a further-along lead
}

/**
 * Convert a lead to a customer record after a completed sale.
 * - Looks up the lead's full data from Supabase.
 * - Finds or creates a customer (matched by personnummer, then email).
 * - Updates the lead: stage → 'closed', customer_id linked, closed_at set.
 * Returns { customerId, created: true } if a new customer row was inserted.
 */
export async function convertLeadToCustomer(
  leadId: number,
): Promise<{ customerId: number | null; created: boolean }> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return { customerId: null, created: false };

  // 1. Fetch full lead row (includes personnummer, email, phone, address, etc.)
  const { data: lead } = await db()
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('dealership_id', dealershipId)
    .maybeSingle();
  if (!lead) return { customerId: null, created: false };

  // 2. Check if a customer already exists (by personnummer first, then email)
  let existingId: number | null = null;
  if (lead.personnummer) {
    const { data: byPnr } = await db()
      .from('customers')
      .select('id')
      .eq('personnummer', lead.personnummer)
      .eq('dealership_id', dealershipId)
      .maybeSingle();
    if (byPnr) existingId = (byPnr as { id: number }).id;
  }
  if (!existingId && lead.email) {
    const { data: byEmail } = await db()
      .from('customers')
      .select('id')
      .eq('email', lead.email)
      .eq('dealership_id', dealershipId)
      .maybeSingle();
    if (byEmail) existingId = (byEmail as { id: number }).id;
  }

  let customerId: number | null = existingId;
  let created = false;

  // 3. Create a new customer record if one doesn't exist yet
  if (!existingId) {
    const nameParts = ((lead.name as string) ?? '').trim().split(/\s+/);
    const firstName = nameParts[0] ?? '';
    const lastName  = nameParts.slice(1).join(' ') || '—';
    const { data: newCustomer, error: insertErr } = await db()
      .from('customers')
      .insert({
        first_name:        firstName,
        last_name:         lastName,
        personnummer:      lead.personnummer || null,
        email:             lead.email        || null,
        phone:             lead.phone        || null,
        address:           lead.address      || null,
        city:              lead.city         || null,
        source:            lead.source === 'BankID' ? 'BankID' : 'Manual',
        bankid_verified:   lead.source === 'BankID',
        tag:               'New',
        lifetime_value:    lead.value        || 0,
        last_activity:     new Date().toISOString(),
        dealership_id:     dealershipId,
      })
      .select('id')
      .single();
    if (!insertErr && newCustomer) {
      customerId = (newCustomer as { id: number }).id;
      created = true;
    } else if (insertErr) {
      if (insertErr.code === '23505') {
        // Duplicate key — customer already exists (race condition or prior partial run).
        // Fall back to a lookup by personnummer then email.
        if (lead.personnummer) {
          const { data: byPnr2 } = await db()
            .from('customers')
            .select('id')
            .eq('personnummer', lead.personnummer)
            .eq('dealership_id', dealershipId)
            .maybeSingle();
          if (byPnr2) customerId = (byPnr2 as { id: number }).id;
        }
        if (!customerId && lead.email) {
          const { data: byEmail2 } = await db()
            .from('customers')
            .select('id')
            .eq('email', lead.email)
            .eq('dealership_id', dealershipId)
            .maybeSingle();
          if (byEmail2) customerId = (byEmail2 as { id: number }).id;
        }
      } else {
        console.error('[leads] convertLeadToCustomer – insert customer:', insertErr.message);
      }
    }
  }

  // 4. Mark the lead as closed and link it to the customer
  await db()
    .from('leads')
    .update({
      stage:       'closed',
      customer_id: customerId,
      closed_at:   new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('dealership_id', dealershipId);

  return { customerId, created };
}

/**
 * Find or create a customer record from a lead WITHOUT closing the lead.
 * Used when a payment is initiated (pending state) so the customer appears
 * in the customers list immediately, before the payment is confirmed.
 */
export async function upsertCustomerFromLead(
  leadId: number,
): Promise<{ customerId: number | null; created: boolean }> {
  const dealershipId = getDealershipId();
  if (!dealershipId) return { customerId: null, created: false };

  const { data: lead } = await db()
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('dealership_id', dealershipId)
    .maybeSingle();
  if (!lead) return { customerId: null, created: false };

  // Check by personnummer first, then email
  let existingId: number | null = null;
  if (lead.personnummer) {
    const { data: byPnr } = await db()
      .from('customers')
      .select('id')
      .eq('personnummer', lead.personnummer)
      .eq('dealership_id', dealershipId)
      .maybeSingle();
    if (byPnr) existingId = (byPnr as { id: number }).id;
  }
  if (!existingId && lead.email) {
    const { data: byEmail } = await db()
      .from('customers')
      .select('id')
      .eq('email', lead.email)
      .eq('dealership_id', dealershipId)
      .maybeSingle();
    if (byEmail) existingId = (byEmail as { id: number }).id;
  }
  if (existingId) return { customerId: existingId, created: false };

  const nameParts = ((lead.name as string) ?? '').trim().split(/\s+/);
  const firstName = nameParts[0] ?? '';
  const lastName  = nameParts.slice(1).join(' ') || '—';
  const { data: newCustomer, error: insertErr } = await db()
    .from('customers')
    .insert({
      first_name:      firstName,
      last_name:       lastName,
      personnummer:    lead.personnummer || null,
      email:           lead.email       || null,
      phone:           lead.phone       || null,
      address:         lead.address     || null,
      city:            lead.city        || null,
      source:          lead.source === 'BankID' ? 'BankID' : 'Manual',
      bankid_verified: lead.source === 'BankID',
      tag:             'New',
      lifetime_value:  lead.value       || 0,
      last_activity:   new Date().toISOString(),
      dealership_id:   dealershipId,
    })
    .select('id')
    .single();
  if (!insertErr && newCustomer) {
    return { customerId: (newCustomer as { id: number }).id, created: true };
  }
  if (insertErr) console.error('[leads] upsertCustomerFromLead:', insertErr.message);
  return { customerId: null, created: false };
}
