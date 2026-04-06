import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getStoredConfig } from '@/lib/payments/config-store';
import { getDealerConfig } from '@/lib/payments/dealer-config';
import { getProvider } from '@/lib/payments/registry';

/**
 * GET /api/payments/enabled?dealershipId=<UUID>&dealerId=<slug>
 *
 * Returns display info for all payment providers the dealer has enabled.
 * Priority:
 *   1. Supabase payment_configs (when dealershipId UUID is provided)
 *   2. File-based config store (data/payment-configs.json)
 *   3. Hardcoded defaults (lib/payments/dealer-config.ts)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dealershipId = searchParams.get('dealershipId');
  const dealerId     = searchParams.get('dealerId') ?? '';

  if (!dealershipId && !dealerId) {
    return NextResponse.json({ error: 'dealershipId or dealerId is required' }, { status: 400 });
  }

  try {
    let providerIds: string[] = [];

    // 1. Supabase
    if (dealershipId) {
      const sb = getSupabaseAdmin();
      const { data } = await sb
        .from('payment_configs')
        .select('provider_id, active')
        .eq('dealership_id', dealershipId)
        .eq('active', true)
        .neq('provider_id', '_settings');

      if (data && data.length > 0) {
        providerIds = (data as { provider_id: string }[]).map(r => r.provider_id);
      }
    }

    // 2. File store fallback
    if (providerIds.length === 0 && dealerId) {
      const stored = getStoredConfig(dealerId);
      if (stored?.enabledProviders?.length) {
        providerIds = stored.enabledProviders;
      }
    }

    // 3. Hardcoded defaults
    if (providerIds.length === 0 && dealerId) {
      providerIds = getDealerConfig(dealerId).enabledProviders;
    }

    const enabledProviders = providerIds
      .map((pid) => getProvider(pid))
      .filter(Boolean)
      .map((p) => ({
        id:           p!.id,
        name:         p!.name,
        icon:         p!.icon,
        description:  p!.description,
        category:     p!.category,
        capabilities: p!.capabilities,
        currencies:   p!.currencies,
      }));

    return NextResponse.json({ enabledProviders });
  } catch (error: any) {
    console.error('[GET /api/payments/enabled]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
