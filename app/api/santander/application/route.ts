import { NextRequest, NextResponse } from 'next/server';
import { createApplication } from '@/lib/santander/client';

/**
 * POST /api/santander/application
 *
 * Create a Santander vehicle financing application.
 * On success Santander sends a BankID signing link to the customer.
 *
 * Body: { agreementNumber, customerPhone, vehicle, balanceDue, downPayment, loanTermMonths, personalNumber, firstName, lastName, email }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      agreementNumber, personalNumber, firstName, lastName,
      email, phone, vehicle, balanceDue, downPayment, loanTermMonths,
    } = body;

    if (!agreementNumber || !personalNumber || !balanceDue) {
      return NextResponse.json(
        { error: 'Missing required fields: agreementNumber, personalNumber, balanceDue' },
        { status: 400 },
      );
    }

    const result = await createApplication({
      merchantOrderId:  agreementNumber,
      applicant:        { personalNumber, firstName, lastName, email, phone },
      vehicle:          { make: vehicle?.make ?? '', model: vehicle?.model ?? '', year: vehicle?.year ?? 0, price: balanceDue },
      loanAmount:       balanceDue - (downPayment ?? 0),
      downPayment:      downPayment ?? 0,
      loanTermMonths:   loanTermMonths ?? 48,
      callbackUrl:      `${process.env.NEXT_PUBLIC_BASE_URL}/api/santander/callback`,
    });

    console.log(`[Santander] Application created — id: ${result.applicationId}, status: ${result.status}`);

    return NextResponse.json({
      applicationId: result.applicationId,
      status:        result.status,
      signingUrl:    result.signingUrl ?? null,
      monthlyAmount: result.monthlyAmount ?? null,
    });
  } catch (error: any) {
    console.error('[Santander /api/santander/application]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
