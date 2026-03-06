import { NextRequest, NextResponse } from 'next/server';
import { cancelApplication } from '@/lib/santander/client';

/** POST /api/santander/application/[applicationId]/cancel */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  try {
    const { applicationId } = await params;
    await cancelApplication(applicationId);
    console.log(`[Santander] Application ${applicationId} cancelled`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Santander cancel]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
