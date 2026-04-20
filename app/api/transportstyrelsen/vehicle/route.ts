import { NextRequest, NextResponse } from 'next/server';
import { lookupVehicle } from '@/lib/transportstyrelsen/client';
import { getCredential } from '@/lib/integrations/config-store';

/**
 * GET /api/transportstyrelsen/vehicle?regNr=ABC123&dealerId=ava-mc
 *
 * Look up a vehicle in Fordonsregistret by its registration plate.
 * Returns make, model, VIN, status (registered/stolen/scrapped), liens, etc.
 */
export async function GET(req: NextRequest) {
  try {
    const dealerId = req.nextUrl.searchParams.get('dealerId') ?? 'ava-mc';
    const regNr    = req.nextUrl.searchParams.get('regNr');

    if (!regNr) {
      return NextResponse.json({ error: 'regNr query parameter required' }, { status: 400 });
    }

    const apiKey = await getCredential(dealerId, 'transportstyrelsen', 'TRANSPORTSTYRELSEN_API_KEY');
    if (!apiKey) {
      return NextResponse.json({ error: 'Transportstyrelsen API key not configured' }, { status: 400 });
    }

    const vehicle = await lookupVehicle(apiKey, regNr);
    return NextResponse.json({ vehicle });
  } catch (error: any) {
    console.error('[transportstyrelsen/vehicle GET]', error.message);
    const status = error.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
