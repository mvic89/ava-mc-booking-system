import { NextRequest, NextResponse } from 'next/server';
import { getApplication } from '@/lib/ikano/client';

/** GET /api/ikano/application/[applicationId] */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  try {
    const { applicationId } = await params;
    const result = await getApplication(applicationId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Ikano GET application]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
