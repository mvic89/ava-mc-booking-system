import { NextRequest, NextResponse } from 'next/server';
import { collect, getHintMessage, getFailureMessage } from '@/lib/bankid/client';
import { mockCollect, mockRoaringData } from '@/lib/bankid/mock';
import { getRoaringClient } from '@/lib/roaring/client';
import { getSupabaseAdmin } from '@/lib/supabase';

const MOCK_MODE = process.env.BANKID_MOCK_MODE === 'true';
const ROARING_MOCK_MODE = process.env.ROARING_MOCK_MODE === 'true';

// ── Log a BankID event to customer_bankid_logs (fire-and-forget) ──────────────
async function logBankIDEvent(params: {
  action:         string;
  status:         'success' | 'failed';
  personalNumber: string | null;
  ipAddress:      string | null;
  orderRef:       string;
  signature:      string | null;
  riskLevel:      string | null;
}) {
  try {
    const sb = getSupabaseAdmin();

    // Resolve customer_id from personnummer (globally unique in Sweden)
    let customerId: number | null = null;
    if (params.personalNumber) {
      const { data } = await sb
        .from('customers')
        .select('id')
        .eq('personnummer', params.personalNumber)
        .maybeSingle();
      customerId = data?.id ?? null;
    }

    await sb.from('customer_bankid_logs').insert({
      customer_id:     customerId,
      action:          params.action,
      status:          params.status,
      personal_number: params.personalNumber,
      ip_address:      params.ipAddress,
      order_ref:       params.orderRef,
      signature:       params.signature,
      risk_level:      params.riskLevel,
    });
  } catch (err) {
    // Never let logging failures surface to the caller
    console.error('[BankID] log error:', err);
  }
}

export const POST = async(req: NextRequest) => {
  try {
    const body = await req.json();
    const { orderRef, action = 'auth' } = body as { orderRef: string; action?: string };

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
      // Log failure (no personal number available — auth never completed)
      logBankIDEvent({
        action, status: 'failed', personalNumber: null,
        ipAddress: null, orderRef, signature: null, riskLevel: null,
      });
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

      // Fetch additional person information from Roaring.io.
      // ROARING_TEST_SSN lets you pin a specific personnummer for Roaring lookups
      // (e.g. the one from your real BankID test account) so address data is returned.
      // In production leave ROARING_TEST_SSN unset — the live BankID personnummer is used.
      const roaringSSN = process.env.ROARING_TEST_SSN || user.personalNumber;

      let roaringData = null;
      if (ROARING_MOCK_MODE) {
        // Return fake population register data in dev — swap for real API once
        // Roaring population register access is approved on your account.
        roaringData = mockRoaringData();
      } else {
        try {
          const roaringClient = getRoaringClient();
          const roaringResult = await roaringClient.getPersonBySSN(roaringSSN, 'SE');

          if (roaringResult.success && roaringResult.data) {
            roaringData = {
              address: roaringResult.data.address,
              gender: roaringResult.data.gender,
              citizenship: roaringResult.data.address?.country,
              status: roaringResult.data.status,
              protectedIdentity: roaringResult.data.protectedIdentity,
              deceased: roaringResult.data.deceased,
            };
          }
        } catch (error) {
          console.error('[BankID Collect] Roaring.io error:', error);
          // Don't fail the whole request if Roaring.io fails
        }
      }

      // Log successful authentication / signing to customer_bankid_logs
      logBankIDEvent({
        action,
        status:         'success',
        personalNumber: pnr,
        ipAddress:      device.ipAddress,
        orderRef,
        signature:      signature || null,
        riskLevel:      risk     || null,
      });

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
        signatureAvailable: !!signature,
        ocspAvailable: !!ocspResponse,
        roaring: roaringData,
      });
    }

    return NextResponse.json({ status: 'unknown' });
  } catch (error: any) {
    console.error('[BankID /collect]', error.message);
    // Return a failed status so the modal shows the error instead of freezing.
    // BankID API errors (cert issues, expired session, etc.) are not 500s — they
    // are expected failures in the authentication flow.
    return NextResponse.json({
      status: 'failed',
      message: error.message || 'BankID collect failed. Please try again.',
    });
  }
}
