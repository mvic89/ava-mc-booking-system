import { NextRequest, NextResponse } from 'next/server';
import { activateApplication } from '@/lib/ikano/client';

/** POST /api/ikano/application/[applicationId]/activate — triggers payout to dealership */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  try {
    const { applicationId } = await params;
    await activateApplication(applicationId);
    console.log(`[Ikano] Application ${applicationId} activated — payout initiated`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Ikano activate]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
