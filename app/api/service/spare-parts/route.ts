import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// GET /api/service/spare-parts?dealershipId=…&q=…
// Searches spare_parts AND accessories by name or article_number
export async function GET(req: NextRequest) {
  const dealershipId = req.nextUrl.searchParams.get('dealershipId');
  const q            = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!dealershipId || q.length < 2) return NextResponse.json({ results: [] });

  const filter = `name.ilike.%${q}%,article_number.ilike.%${q}%`;

  const [partsRes, accRes] = await Promise.all([
    sb()
      .from('spare_parts')
      .select('id, name, article_number, stock, selling_price, cost, vendor, category')
      .eq('dealership_id', dealershipId)
      .or(filter)
      .order('stock', { ascending: false })
      .limit(8),
    sb()
      .from('accessories')
      .select('id, name, article_number, stock, selling_price, cost, vendor, category, size')
      .eq('dealership_id', dealershipId)
      .or(filter)
      .order('stock', { ascending: false })
      .limit(8),
  ]);

  const parts = (partsRes.data ?? []).map((r: Record<string, unknown>) => ({ ...r, item_type: 'spare_part' }));
  const accs  = (accRes.data  ?? []).map((r: Record<string, unknown>) => ({ ...r, item_type: 'accessory'  }));

  // Merge and sort in-stock first
  const merged = [...parts, ...accs].sort((a, b) => (b.stock as number) - (a.stock as number)).slice(0, 12);

  return NextResponse.json({ results: merged });
}
