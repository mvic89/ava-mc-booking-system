import { NextRequest, NextResponse } from 'next/server';
import { deleteAd, updateAd } from '@/lib/blocket/client';
import { getCredential } from '@/lib/integrations/config-store';

/**
 * DELETE /api/blocket/ad/[id]?dealerId=ava-mc
 *
 * Remove a Blocket listing — called automatically when a vehicle is sold.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }    = await params;
    const dealerId  = req.nextUrl.searchParams.get('dealerId') ?? 'ava-mc';
    const apiKey    = await getCredential(dealerId, 'blocket', 'BLOCKET_API_KEY');
    const accountId = await getCredential(dealerId, 'blocket', 'BLOCKET_ACCOUNT_ID');

    if (!apiKey || !accountId) {
      return NextResponse.json({ error: 'Blocket credentials not configured' }, { status: 400 });
    }

    await deleteAd(apiKey, accountId, id);
    return NextResponse.json({ success: true, message: `Ad ${id} removed from Blocket` });
  } catch (error: any) {
    console.error('[blocket/ad DELETE]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/blocket/ad/[id]
 *
 * Update listing price or details.
 * Body: { dealerId: string; subject?: string; price?: number; body?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id }   = await params;
    const body     = await req.json() as { dealerId?: string; [key: string]: unknown };
    const dealerId = (body.dealerId as string) ?? 'ava-mc';
    const apiKey    = await getCredential(dealerId, 'blocket', 'BLOCKET_API_KEY');
    const accountId = await getCredential(dealerId, 'blocket', 'BLOCKET_ACCOUNT_ID');

    if (!apiKey || !accountId) {
      return NextResponse.json({ error: 'Blocket credentials not configured' }, { status: 400 });
    }

    const { dealerId: _d, ...patch } = body;
    const ad = await updateAd(apiKey, accountId, id, patch as never);
    return NextResponse.json({ ad });
  } catch (error: any) {
    console.error('[blocket/ad PATCH]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
