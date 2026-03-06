import { NextRequest, NextResponse } from 'next/server';
import { getStoredConfig } from '@/lib/payments/config-store';
import { getProvider } from '@/lib/payments/registry';

/**
 * GET /api/payments/enabled?dealerId=ava-mc
 *
 * Returns the display info (name, icon, description, category) for all payment
 * providers the dealer has enabled in their Settings → Payment Providers.
 * No credentials are ever returned.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dealerId = searchParams.get('dealerId');

  if (!dealerId) {
    return NextResponse.json({ error: 'dealerId is required' }, { status: 400 });
  }

  try {
    const config = await getStoredConfig(dealerId);

    if (!config || !config.enabledProviders?.length) {
      return NextResponse.json({ enabledProviders: [] });
    }

    const enabledProviders = config.enabledProviders
      .map((id) => getProvider(id))
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
