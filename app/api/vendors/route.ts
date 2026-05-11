import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/vendors?dealershipId=…
// Returns vendor names + emails for autocomplete in the PO creation form.
export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  if (!dealershipId) return NextResponse.json({ vendors: [] });

  const { data, error } = await sb()
    .from('vendors')
    .select('name, email, contact_person')
    .eq('dealership_id', dealershipId)
    .order('name');

  if (error) return NextResponse.json({ vendors: [] });
  return NextResponse.json({ vendors: data ?? [] });
}
