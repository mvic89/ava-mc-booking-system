import { NextRequest, NextResponse } from 'next/server';
import { createCustomer, getCustomerByOrgNumber } from '@/lib/fortnox/client';
import { getCredential } from '@/lib/integrations/config-store';

async function getToken(dealerId: string) {
  return await getCredential(dealerId, 'fortnox', 'FORTNOX_ACCESS_TOKEN');
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
  let body: {
    dealerId?:       string;
    name:            string;
    personalNumber?: string;
    address?:        string;
    city?:           string;
    zipCode?:        string;
    email?:          string;
    phone?:          string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const dealerId = body.dealerId ?? 'ava-mc';
  const token    = await getToken(dealerId);

  // Fortnox is optional — if not configured, skip gracefully
  if (!token) {
    return NextResponse.json({ skipped: true, reason: 'Fortnox not configured' });
  }

  try {
    // Check if customer already exists by org/personal number
    if (body.personalNumber) {
      const existing = await getCustomerByOrgNumber(token, body.personalNumber);
      if (existing) {
        return NextResponse.json({ customer: existing, created: false });
      }
    }

    const customer = await createCustomer(token, {
      Name:               body.name,
      OrganisationNumber: body.personalNumber,
      Address1:           body.address,
      City:               body.city,
      ZipCode:            body.zipCode,
      Country:            'Sverige',
      Email:              body.email,
      Phone1:             body.phone,
      Type:               'PRIVATE',
    });

    return NextResponse.json({ customer, created: true });
  } catch (error: unknown) {
    // External Fortnox API error — log but don't surface as 500
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[fortnox/customer POST] Fortnox API error (integration skipped):', msg);
    return NextResponse.json({ skipped: true, reason: msg }, { status: 502 });
  }
}
