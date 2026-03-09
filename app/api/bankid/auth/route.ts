import { NextRequest, NextResponse } from 'next/server';
import { startAuth, startSign } from '@/lib/bankid/client';
import { mockAuth } from '@/lib/bankid/mock';
import { headers } from 'next/headers';

const MOCK_MODE = process.env.BANKID_MOCK_MODE === 'true';

export const POST = async(req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const mode: 'auth' | 'sign' = body.mode || 'auth';
    const userVisibleData: string | undefined = body.userVisibleData;

    // Debug: Log environment variable
    console.log('[BankID] BANKID_MOCK_MODE =', process.env.BANKID_MOCK_MODE);
    console.log('[BankID] MOCK_MODE =', MOCK_MODE);

    let result;

    // Use mock data if mock mode is enabled
    if (MOCK_MODE) {
      console.log('[BankID] 🎭 Mock mode enabled - using fake data');
      result = mockAuth();
    } else {
      // Get real end-user IP
      const headersList = await headers();
      const endUserIp =
        headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headersList.get('x-real-ip') ||
        '127.0.0.1';

      if (mode === 'sign' && userVisibleData) {
        result = await startSign(endUserIp, userVisibleData);
      } else {
        result = await startAuth(endUserIp, userVisibleData || 'Identifiering via BikeMeNow');
      }
    }

    // IMPORTANT: qrStartSecret stays on the server in production.
    // For this implementation we send it to the client to compute
    // the animated QR in the browser. In a stricter setup you'd
    // have a /api/bankid/qr endpoint that returns a new QR image
    // every second server-side.
    return NextResponse.json({
      orderRef: result.orderRef,
      autoStartToken: result.autoStartToken,
      qrStartToken: result.qrStartToken,
      qrStartSecret: result.qrStartSecret,
    });
  } catch (error: any) {
    console.error('[BankID /auth]', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}