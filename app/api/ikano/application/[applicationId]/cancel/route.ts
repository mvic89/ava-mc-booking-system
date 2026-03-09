import { NextRequest, NextResponse } from 'next/server';
import { cancelApplication } from '@/lib/ikano/client';

/** POST /api/ikano/application/[applicationId]/cancel */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  try {
    const { applicationId } = await params;
    await cancelApplication(applicationId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Ikano cancel]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
