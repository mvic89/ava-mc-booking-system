import { NextRequest, NextResponse } from 'next/server';
import { createApplication } from '@/lib/ikano/client';

/**
 * POST /api/ikano/application
 *
 * Create an Ikano Bank credit application for a vehicle purchase.
 * Returns signingUrl — send this to the customer for BankID signing.
 *
 * Body: { agreementNumber, personalNumber, firstName, lastName, email, phone, address, products, loanAmount, downPayment, campaignCode? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agreementNumber, personalNumber, firstName, lastName, email, phone, address, products, loanAmount, downPayment, campaignCode } = body;

    if (!agreementNumber || !personalNumber || !loanAmount) {
      return NextResponse.json(
        { error: 'Missing required fields: agreementNumber, personalNumber, loanAmount' },
        { status: 400 },
      );
    }

    const result = await createApplication({
      storeId:        process.env.IKANO_STORE_ID ?? '',
      orderReference: agreementNumber,
      applicant:      { personalNumber, firstName, lastName, email, phone, address },
      products:       products ?? [],
      loanAmount,
      downPayment:    downPayment ?? 0,
      campaignCode,
      callbackUrl:    `${process.env.NEXT_PUBLIC_BASE_URL}/api/ikano/callback`,
    });

    console.log(`[Ikano] Application ${result.applicationId} created — status: ${result.status}`);
    return NextResponse.json({
      applicationId: result.applicationId,
      status:        result.status,
      signingUrl:    result.signingUrl ?? null,
      monthlyAmount: result.monthlyAmount ?? null,
    });
  } catch (error: any) {
    console.error('[Ikano POST application]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
