import { NextRequest, NextResponse } from 'next/server';
import { getCampaigns } from '@/lib/ikano/client';

/** GET /api/ikano/campaigns?amount=50000 */
export async function GET(req: NextRequest) {
  try {
    const amount = Number(req.nextUrl.searchParams.get('amount') ?? 0);
    const campaigns = await getCampaigns(amount);
    return NextResponse.json(campaigns);
  } catch (error: any) {
    console.error('[Ikano campaigns]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
