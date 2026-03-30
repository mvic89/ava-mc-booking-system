/**
 * Roaring.io Company API Route
 *
 * GET /api/roaring/company?orgNumber=123456-7890&country=SE
 *
 * Retrieves company information from Roaring.io Company API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRoaringClient } from '@/lib/roaring/client';

const MOCK_COMPANY = {
  companyName: 'BikeMeNow Demo AB',
  visitingAddress: {
    street: 'Storgatan 1',
    postalCode: '11122',
    town: 'Stockholm',
  },
  phoneNumber: '0812345678',
  website: 'https://bikemenow.se',
};

export async function GET(request: NextRequest) {
  // In mock mode, return fake company data so the UX can be tested without Roaring company access
  if (process.env.ROARING_MOCK_MODE === 'true') {
    return NextResponse.json({ success: true, data: MOCK_COMPANY });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const orgNumber = searchParams.get('orgNumber');
    const country = (searchParams.get('country') || 'SE').toUpperCase() as 'SE' | 'NO' | 'DK' | 'FI' | 'ES';

    // Validate required parameters
    if (!orgNumber) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: 'Organization number is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate country parameter
    const validCountries = ['SE', 'NO', 'DK', 'FI', 'ES'];
    if (!validCountries.includes(country)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_COUNTRY',
            message: `Country must be one of: ${validCountries.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Get Roaring.io client
    const roaringClient = getRoaringClient();

    // Fetch company data
    const result = await roaringClient.getCompanyByOrgNumber(orgNumber, country);

    console.log('[roaring/company] orgNumber:', orgNumber, '| success:', result.success, '| error:', result.error, '| data keys:', result.data ? Object.keys(result.data) : null);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Roaring.io Company API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (process.env.ROARING_MOCK_MODE === 'true') {
    return NextResponse.json({ success: true, data: MOCK_COMPANY });
  }

  try {
    const body = await request.json();
    const { orgNumber, country = 'SE' } = body;

    // Validate required parameters
    if (!orgNumber) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: 'Organization number is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate country parameter
    const validCountries = ['SE', 'NO', 'DK', 'FI', 'ES'];
    if (!validCountries.includes(country.toUpperCase())) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_COUNTRY',
            message: `Country must be one of: ${validCountries.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Get Roaring.io client
    const roaringClient = getRoaringClient();

    // Fetch company data
    const result = await roaringClient.getCompanyByOrgNumber(orgNumber, country.toUpperCase());

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Roaring.io Company API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}
