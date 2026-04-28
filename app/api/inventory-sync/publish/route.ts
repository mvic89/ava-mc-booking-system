import { NextRequest, NextResponse } from 'next/server';
import { syncPublish, type SyncItem } from '@/lib/inventory-sync';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCredential } from '@/lib/integrations/config-store';

/**
 * POST /api/inventory-sync/publish
 *
 * Called when a new inventory item is added to stock.
 * Publishes to Blocket and the dealership's website webhook.
 * Records the resulting blocket_ad_id in the blocket_listings table.
 *
 * Body: SyncItem
 */
export async function POST(req: NextRequest) {
  try {
    const item = await req.json() as SyncItem;

    const dealerId   = item.dealershipId;
    const webhookUrl = await getCredential(dealerId, 'dealer_website', 'WEBSITE_WEBHOOK_URL')
                    || process.env.WEBSITE_WEBHOOK_URL || '';
    const apiKey     = await getCredential(dealerId, 'dealer_website', 'WEBSITE_API_KEY')
                    || process.env.WEBSITE_API_KEY || '';

    const { blocket, website } = await syncPublish(item, webhookUrl || undefined, apiKey || undefined);

    // Persist Blocket listing record if we got an ad ID back
    if (blocket.ok && blocket.externalId) {
      const supabase = getSupabaseAdmin();
      await supabase.from('blocket_listings').insert({
        dealership_id:     dealerId,
        inventory_item_id: item.id,
        item_type:         item.itemType,
        blocket_ad_id:     blocket.externalId,
        status:            'active',
        published_at:      new Date().toISOString(),
      });
    } else if (!blocket.skipped && !blocket.ok) {
      // Log error row so dealer can see it in settings
      const supabase = getSupabaseAdmin();
      await supabase.from('blocket_listings').insert({
        dealership_id:     dealerId,
        inventory_item_id: item.id,
        item_type:         item.itemType,
        status:            'error',
        error_message:     blocket.error ?? 'Unknown error',
      });
    }

    return NextResponse.json({ blocket, website });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('[inventory-sync/publish]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
