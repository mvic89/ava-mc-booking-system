import { NextRequest, NextResponse } from 'next/server';
import { syncUnpublish, type SyncItem } from '@/lib/inventory-sync';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCredential } from '@/lib/integrations/config-store';

/**
 * POST /api/inventory-sync/unpublish
 *
 * Called when an inventory item is sold or removed from stock.
 * Removes from Blocket, fires website webhook with event='sold'.
 * Updates blocket_listings status to 'removed'.
 *
 * Body: { item: SyncItem; blocketAdId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { item: SyncItem; blocketAdId?: string };
    const { item } = body;
    let { blocketAdId } = body;

    const dealerId = item.dealershipId;

    // Look up blocketAdId from DB if not passed directly
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

    const { blocket, website } = await syncUnpublish(
      item,
      blocketAdId,
      webhookUrl || undefined,
      apiKey || undefined,
    );

    // Mark listing as removed
    if (blocketAdId) {
      const supabase = getSupabaseAdmin();
      await supabase
        .from('blocket_listings')
        .update({ status: 'removed', removed_at: new Date().toISOString() })
        .eq('inventory_item_id', item.id)
        .eq('dealership_id', dealerId)
        .eq('status', 'active');
    }

    return NextResponse.json({ blocket, website, blocketAdId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('[inventory-sync/unpublish]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
