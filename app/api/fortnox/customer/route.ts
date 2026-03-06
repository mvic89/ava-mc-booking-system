import { NextRequest, NextResponse } from 'next/server';
import { createCustomer, getCustomerByOrgNumber } from '@/lib/fortnox/client';
import { getCredential } from '@/lib/integrations/config-store';

function getToken(dealerId: string) {
  return getCredential(dealerId, 'fortnox', 'FORTNOX_ACCESS_TOKEN');
}

/**
 * POST /api/fortnox/customer
 *
 * Create or upsert a Fortnox customer.
 * Returns the Fortnox CustomerNumber so it can be passed to invoice creation.
 *
 * Body: {
 *   dealerId:      string
 *   name:          string
 *   personalNumber?: string   (personnummer for private customer)
 *   address?:      string
 *   city?:         string
 *   zipCode?:      string
 *   email?:        string
 *   phone?:        string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealerId?:      string;
      name:           string;
      personalNumber?: string;
      address?:       string;
      city?:          string;
      zipCode?:       string;
      email?:         string;
      phone?:         string;
    };

    const dealerId = body.dealerId ?? 'ava-mc';
    const token    = getToken(dealerId);
    if (!token) {
      return NextResponse.json({ error: 'Fortnox access token not configured' }, { status: 400 });
    }

    // Check if customer already exists by org/personal number
    if (body.personalNumber) {
      const existing = await getCustomerByOrgNumber(token, body.personalNumber);
      if (existing) {
        return NextResponse.json({ customer: existing, created: false });
      }
    }

    const customer = await createCustomer(token, {
      Name:                body.name,
      OrganisationNumber:  body.personalNumber,
      Address1:            body.address,
      City:                body.city,
      ZipCode:             body.zipCode,
      Country:             'Sverige',
      Email:               body.email,
      Phone1:              body.phone,
      Type:                'PRIVATE',
    });

    return NextResponse.json({ customer, created: true });
  } catch (error: any) {
    console.error('[fortnox/customer POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
