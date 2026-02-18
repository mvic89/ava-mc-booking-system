import { NextRequest, NextResponse } from 'next/server';
import { collect, getHintMessage, getFailureMessage } from '@/lib/bankid/client';
import { mockCollect } from '@/lib/bankid/mock';
import { getRoaringClient } from '@/lib/roaring/client';

const MOCK_MODE = process.env.BANKID_MOCK_MODE === 'true';

export async function POST(req: NextRequest) {
  try {
    const { orderRef } = await req.json();

    if (!orderRef) {
      return NextResponse.json({ error: 'orderRef required' }, { status: 400 });
    }

    // Use mock data if mock mode is enabled
    const result = MOCK_MODE ? mockCollect(orderRef) : await collect(orderRef);

    // ─── PENDING ─────────────────────────────────────
    if (result.status === 'pending') {
      return NextResponse.json({
        status: 'pending',
        hintCode: result.hintCode,
        message: getHintMessage(result.hintCode || ''),
      });
    }

    // ─── FAILED ──────────────────────────────────────
    if (result.status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        hintCode: result.hintCode,
        message: getFailureMessage(result.hintCode || ''),
      });
    }

    // ─── COMPLETE ────────────────────────────────────
    if (result.status === 'complete' && result.completionData) {
      const { user, device, risk, signature, ocspResponse, bankIdIssueDate } = result.completionData;

      // Extract DOB from personnummer: YYYYMMDDXXXX → YYYY-MM-DD
      const pnr = user.personalNumber;
      const dateOfBirth = `${pnr.slice(0, 4)}-${pnr.slice(4, 6)}-${pnr.slice(6, 8)}`;

      // Fetch additional person information from Roaring.io
      let roaringData = null;
      try {
        const roaringClient = getRoaringClient();
        const roaringResult = await roaringClient.getPersonBySSN(user.personalNumber, 'SE');

        if (roaringResult.success && roaringResult.data) {
          roaringData = {
            address: roaringResult.data.address,
            gender: roaringResult.data.gender,
            citizenship: roaringResult.data.address?.country,
            status: roaringResult.data.status,
            protectedIdentity: roaringResult.data.protectedIdentity,
            deceased: roaringResult.data.deceased,
          };
          console.log('[BankID Collect] Roaring.io data fetched successfully');
        } else {
          console.warn('[BankID Collect] Failed to fetch Roaring.io data:', roaringResult.error);
        }
      } catch (error) {
        console.error('[BankID Collect] Error fetching Roaring.io data:', error);
        // Don't fail the whole request if Roaring.io fails
      }

      return NextResponse.json({
        status: 'complete',
        user: {
          personalNumber: user.personalNumber,
          givenName: user.givenName,
          surname: user.surname,
          name: user.name,
          dateOfBirth,
        },
        device: {
          ipAddress: device.ipAddress,
        },
        risk,
        bankIdIssueDate,
        // In production, you'd store these in the DB rather than
        // sending them to the client:
        signatureAvailable: !!signature,
        ocspAvailable: !!ocspResponse,
        // Additional Roaring.io data
        roaring: roaringData,
      });
    }

    return NextResponse.json({ status: 'unknown' });
  } catch (error: any) {
    console.error('[BankID /collect]', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
