import { NextRequest, NextResponse } from 'next/server';
import { blocketUpdatePrice, websiteSync, type SyncItem } from '@/lib/inventory-sync';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCredential } from '@/lib/integrations/config-store';

/**
 * POST /api/inventory-sync/update
 *
 * Called when an inventory item's price or details change.
 * Updates Blocket listing price and fires website webhook with event='updated'.
 *
 * Body: { item: SyncItem; blocketAdId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { item: SyncItem; blocketAdId?: string };
    const { item } = body;
    let { blocketAdId } = body;

    const dealerId = item.dealershipId;

    if (!blocketAdId) {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('blocket_listings')
        .select('blocket_ad_id')
        .eq('inventory_item_id', item.id)
        .eq('dealership_id', dealerId)
        .eq('status', 'active')
        .maybeSingle();
      blocketAdId = data?.blocket_ad_id ?? undefined;
    }

    const webhookUrl = await getCredential(dealerId, 'dealer_website', 'WEBSITE_WEBHOOK_URL')
                    || process.env.WEBSITE_WEBHOOK_URL || '';
    const apiKey     = await getCredential(dealerId, 'dealer_website', 'WEBSITE_API_KEY')
                    || process.env.WEBSITE_API_KEY || '';

    const [blocket, website] = await Promise.all([
      blocketAdId
        ? blocketUpdatePrice(blocketAdId, item.price)
        : Promise.resolve({ ok: false as const, skipped: true as const, provider: 'blocket' as const }),
      websiteSync(webhookUrl || '', apiKey || '', 'updated', item, blocketAdId),
    ]);

    return NextResponse.json({ blocket, website });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('[inventory-sync/update]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
