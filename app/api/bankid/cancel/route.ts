import { NextRequest, NextResponse } from 'next/server';
import { cancel } from '@/lib/bankid/client';
import { mockCancel } from '@/lib/bankid/mock';

const MOCK_MODE = process.env.BANKID_MOCK_MODE === 'true';

export async function POST(req: NextRequest) {
  try {
    const { orderRef } = await req.json();
    if (!orderRef) {
      return NextResponse.json({ error: 'orderRef required' }, { status: 400 });
    }

    // Use mock cancel if mock mode is enabled
    if (MOCK_MODE) {
      mockCancel(orderRef);
    } else {
      await cancel(orderRef);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Swallow cancel errors - order may already be gone
    return NextResponse.json({ success: true });
  }
}
