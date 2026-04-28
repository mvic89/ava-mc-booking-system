// POST /api/customers/create
// Auto-creates or finds a customer after a completed lead agreement.
// Uses the service-role key to bypass RLS.
//
// Accepts: { leadId: number, dealershipId: string }
// Returns: { customerId: number | null, created: boolean } or { error: string }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return getSupabaseAdmin(); }

// ── Personnummer utilities ────────────────────────────────────────────────────
// Swedish personnummer: YYYYMMDDNNNN (12 digits) or YYMMDDNNNN (10 digits)
// Gender digit = 10th character (12-digit) or 8th character (10-digit), 0-indexed
//   odd  = Man (male)
//   even = Kvinna (female)

function genderFromPnr(pnr: string | null | undefined): 'Man' | 'Kvinna' {
  if (!pnr) return 'Man';
  const d = pnr.replace(/\D/g, '');
  const idx = d.length === 12 ? 10 : 8;
  const digit = parseInt(d[idx] ?? '1', 10);
  return digit % 2 !== 0 ? 'Man' : 'Kvinna';
}

function birthDateFromPnr(pnr: string | null | undefined): string | null {
  if (!pnr) return null;
  const d = pnr.replace(/\D/g, '');
  if (d.length === 12) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  if (d.length >= 10) {
    const yy = parseInt(d.slice(0, 2), 10);
    const currentYY = new Date().getFullYear() % 100;
    const century = yy > currentYY ? 1900 : 2000;
    return `${century + yy}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: Row = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const leadId       = Number(body.leadId);
  const dealershipId = String(body.dealershipId ?? '').trim();

  console.log('[customers/create] called — leadId:', leadId, 'dealershipId:', dealershipId);

  if (!leadId || Number.isNaN(leadId) || !dealershipId) {
    console.error('[customers/create] missing params — body:', JSON.stringify(body));
    return NextResponse.json({ error: 'leadId and dealershipId are required' }, { status: 400 });
  }

  // ── 1. Fetch lead ─────────────────────────────────────────────────────────
  const { data: lead, error: leadErr } = await sb()
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('dealership_id', dealershipId)
    .maybeSingle();

  if (leadErr) {
    console.error('[customers/create] fetch lead error:', leadErr.message, leadErr.code);
    return NextResponse.json({ error: 'Fetch lead failed: ' + leadErr.message }, { status: 500 });
  }

  // Fallback: try without dealership filter if not found (handles UUID mismatch)
  let effectiveLead: Row = lead;
  let effectiveDealershipId = dealershipId;

  if (!lead) {
    console.warn('[customers/create] no lead found with dealershipId filter — trying without');
    const { data: fb } = await sb().from('leads').select('*').eq('id', leadId).maybeSingle();
    if (!fb) {
      console.error('[customers/create] lead not found at all for id:', leadId);
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    effectiveLead = fb;
    effectiveDealershipId = String(fb.dealership_id ?? dealershipId);
    console.log('[customers/create] found lead via fallback, dealership_id:', effectiveDealershipId);
  }

  return handleCreate(effectiveLead, effectiveDealershipId);
}

async function handleCreate(lead: Row, dealershipId: string): Promise<NextResponse> {
  console.log('[customers/create] processing lead:', {
    id: lead.id, name: lead.name, email: lead.email,
    personnummer: lead.personnummer, source: lead.source,
    gender: lead.gender, address: lead.address, city: lead.city,
  });

  // ── 2. Check existing customer ────────────────────────────────────────────
  // Use .limit(1) + first-row selection instead of .maybeSingle() so that if
  // duplicates already exist in the DB we still find one and update it instead
  // of cascading yet another duplicate.
  let existingId: number | null = null;

  if (lead.personnummer) {
    const { data: rows } = await sb()
      .from('customers').select('id')
      .eq('personnummer', lead.personnummer)
      .eq('dealership_id', dealershipId)
      .limit(1);
    const byPnr = rows?.[0] ?? null;
    if (byPnr) { existingId = byPnr.id; console.log('[customers/create] found by pnr:', existingId); }
  }

  if (!existingId && lead.email) {
    const { data: rows } = await sb()
      .from('customers').select('id')
      .eq('email', lead.email)
      .eq('dealership_id', dealershipId)
      .limit(1);
    const byEmail = rows?.[0] ?? null;
    if (byEmail) { existingId = byEmail.id; console.log('[customers/create] found by email:', existingId); }
  }

  if (!existingId && lead.phone) {
    const { data: rows } = await sb()
      .from('customers').select('id')
      .eq('phone', lead.phone)
      .eq('dealership_id', dealershipId)
      .limit(1);
    const byPhone = rows?.[0] ?? null;
    if (byPhone) { existingId = byPhone.id; console.log('[customers/create] found by phone:', existingId); }
  }

  let customerId: number | null = existingId;
  let created = false;

  // ── 3. Create customer if not found ──────────────────────────────────────
  if (!existingId) {
    const nameParts = String(lead.name ?? '').trim().split(/\s+/);
    const firstName  = nameParts[0] ?? '';
    const lastName   = nameParts.slice(1).join(' ') || '—';
    const leadValue  = parseFloat(String(lead.value ?? '0')) || 0;

    // Prefer explicit gender from lead; fall back to derivation from personnummer
    const gender    = (lead.gender as string) || genderFromPnr(lead.personnummer as string);
    const birthDate = (lead.birth_date as string) || birthDateFromPnr(lead.personnummer as string);

    const payload: Row = {
      first_name:         firstName,
      last_name:          lastName,
      personnummer:       lead.personnummer   || null,
      email:              lead.email          || null,
      phone:              lead.phone          || null,
      address:            lead.address        || null,
      postal_code:        lead.postal_code    || null,
      city:               lead.city           || null,
      birth_date:         birthDate           || null,
      gender:             gender,
      source:             lead.source === 'BankID' ? 'BankID' : 'Manual',
      bankid_verified:    lead.source === 'BankID',
      protected_identity: false,
      tag:                'Active',
      lifetime_value:     leadValue,
      last_activity:      new Date().toISOString(),
      customer_since:     new Date().toISOString(),
      risk_level:         'low',
      citizenship:        null,
      deceased:           false,
      notes:              null,
      dealership_id:      dealershipId,
    };

    console.log('[customers/create] inserting payload:', JSON.stringify(payload));

    const { data: newCust, error: insertErr } = await sb()
      .from('customers').insert(payload).select('id').single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        // Race — re-look up by personnummer, email, then phone
        console.warn('[customers/create] duplicate on insert, re-looking up');
        if (lead.personnummer) {
          const { data: r1 } = await sb().from('customers').select('id')
            .eq('personnummer', lead.personnummer).eq('dealership_id', dealershipId).limit(1);
          if (r1?.[0]) customerId = r1[0].id;
        }
        if (!customerId && lead.email) {
          const { data: r2 } = await sb().from('customers').select('id')
            .eq('email', lead.email).eq('dealership_id', dealershipId).limit(1);
          if (r2?.[0]) customerId = r2[0].id;
        }
        if (!customerId && lead.phone) {
          const { data: r3 } = await sb().from('customers').select('id')
            .eq('phone', lead.phone).eq('dealership_id', dealershipId).limit(1);
          if (r3?.[0]) customerId = r3[0].id;
        }
      } else {
        console.error('[customers/create] INSERT error:', insertErr.message, 'code:', insertErr.code,
          'details:', insertErr.details, 'hint:', insertErr.hint);
        return NextResponse.json({
          error: insertErr.message,
          code:  insertErr.code,
          hint:  insertErr.hint ?? '',
        }, { status: 500 });
      }
    } else if (newCust) {
      customerId = newCust.id;
      created = true;
      console.log('[customers/create] created new customer:', customerId);
      logAudit({
        action:       'CUSTOMER_CREATED',
        entity:       'customer',
        entityId:     newCust.id,
        details:      { name: `${firstName} ${lastName}`.trim(), source: payload.source, lead_id: lead.id },
        dealershipId: dealershipId,
      });
    }
  } else {
    // Existing customer: update lifetime_value + last_activity + fill missing fields
    const leadValue = parseFloat(String(lead.value ?? '0')) || 0;
    const { data: ex } = await sb().from('customers')
      .select('lifetime_value, tag, gender, birth_date')
      .eq('id', existingId).eq('dealership_id', dealershipId).maybeSingle();
    const prev    = parseFloat(String(ex?.lifetime_value ?? '0')) || 0;
    const prevTag = String(ex?.tag ?? 'New');

    const updates: Row = {
      lifetime_value: prev + leadValue,
      last_activity:  new Date().toISOString(),
      tag:            prevTag === 'Inactive' ? 'Active' : prevTag,
    };

    // Fill in gender/birth_date if they were null in the DB
    if (!ex?.gender && lead.personnummer) {
      updates.gender = genderFromPnr(lead.personnummer as string);
    }
    if (!ex?.birth_date && lead.personnummer) {
      updates.birth_date = birthDateFromPnr(lead.personnummer as string);
    }

    await sb().from('customers').update(updates).eq('id', existingId).eq('dealership_id', dealershipId);
    console.log('[customers/create] updated existing customer', existingId, '+', leadValue, 'kr');
  }

  // ── 4. Mark lead closed + link customer_id ────────────────────────────────
  const { error: updErr } = await sb().from('leads').update({
    stage:       'closed',
    customer_id: customerId,
    closed_at:   new Date().toISOString(),
  }).eq('id', lead.id).eq('dealership_id', dealershipId);

  if (updErr) console.error('[customers/create] update lead stage failed:', updErr.message);

  console.log('[customers/create] done — customerId:', customerId, 'created:', created);

  if (created) {
    notify({
      dealershipId,
      type:    'customer',
      title:   'Ny kund skapad',
      message: `${lead.name} är nu registrerad som kund`,
      href:    `/customers/${customerId}`,
    });
  }

  return NextResponse.json({ customerId, created });
}
