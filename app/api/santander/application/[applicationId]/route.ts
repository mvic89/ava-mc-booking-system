import { NextRequest, NextResponse } from 'next/server';
import { getApplication } from '@/lib/santander/client';

/** GET /api/santander/application/[applicationId] — Poll application status */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  try {
    const { applicationId } = await params;
    const result = await getApplication(applicationId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Santander GET application]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
