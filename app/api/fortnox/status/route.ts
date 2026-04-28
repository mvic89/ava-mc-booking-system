// GET /api/fortnox/status?dealershipId=xxx
//
// Returns the Fortnox connection status and invoice sync statistics for the
// /accounting page header card.
//
// Response:
// {
//   tokenConfigured: boolean      — token is stored in config store
//   connected:       boolean      — token is valid (tested against Fortnox API)
//   companyName:     string|null  — from Fortnox /companyinformation
//   stats: {
//     total:   number             — total paid invoices for this dealership
//     synced:  number             — invoices with fortnox_invoice_number set
//     pending: number             — paid invoices not yet synced (no error)
//     failed:  number             — invoices with fortnox_sync_error set
//   }
// }

import { NextRequest, NextResponse } from 'next/server';
import { getCredential } from '@/lib/integrations/config-store';
import { testConnection } from '@/lib/fortnox/client';
import { getSupabaseAdmin } from '@/lib/supabase';

const FORTNOX_API_BASE = process.env.FORTNOX_API_URL ?? 'https://api.fortnox.se/3';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

async function getCompanyName(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${FORTNOX_API_BASE}/companyinformation`, {
      headers: {
        Authorization:  `Bearer ${token}`,
        Accept:         'application/json',
      },
    });
    if (!res.ok) return null;
    const data = await res.json() as { CompanyInformation?: { CompanyName?: string } };
    return data.CompanyInformation?.CompanyName ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId') ?? '';
  if (!dealershipId) {
    return NextResponse.json({ error: 'dealershipId is required' }, { status: 400 });
  }

  const token          = await getCredential(dealershipId, 'fortnox', 'FORTNOX_ACCESS_TOKEN');
  const tokenConfigured = Boolean(token);

  // Test connection + get company name (parallel)
  const [connected, companyName] = await Promise.all([
    tokenConfigured ? testConnection(token) : Promise.resolve(false),
    tokenConfigured ? getCompanyName(token) : Promise.resolve(null),
  ]);

  // Invoice sync stats
  const { data: invoiceRows } = await sb()
    .from('invoices')
    .select('fortnox_invoice_number, fortnox_sync_error')
    .eq('dealership_id', dealershipId)
    .eq('status', 'paid');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (invoiceRows ?? []) as any[];
  const total   = rows.length;
  const synced  = rows.filter(r => r.fortnox_invoice_number).length;
  const failed  = rows.filter(r => !r.fortnox_invoice_number && r.fortnox_sync_error).length;
  const pending = total - synced - failed;

  return NextResponse.json({
    tokenConfigured,
    connected,
    companyName,
    stats: { total, synced, pending, failed },
  });
}
