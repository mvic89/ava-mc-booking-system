/**
 * Roaring.io Person API Route
 *
 * GET /api/roaring/person?ssn=YYYYMMDDXXXX&country=SE
 *
 * Retrieves person information from Roaring.io Population Register API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRoaringClient } from '@/lib/roaring/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ssn = searchParams.get('ssn');
    const country = (searchParams.get('country') || 'SE').toUpperCase() as 'SE' | 'NO' | 'DK' | 'FI';

    // Validate required parameters
    if (!ssn) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: 'SSN (social security number) is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate country parameter
    const validCountries = ['SE', 'NO', 'DK', 'FI'];
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

    // Fetch person data
    const result = await roaringClient.getPersonBySSN(ssn, country);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Roaring.io Person API Error:', error);

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
  try {
    const body = await request.json();
    const { ssn, country = 'SE' } = body;

    // Validate required parameters
    if (!ssn) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: 'SSN (social security number) is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate country parameter
    const validCountries = ['SE', 'NO', 'DK', 'FI'];
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

    // Fetch person data
    const result = await roaringClient.getPersonBySSN(ssn, country.toUpperCase());

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Roaring.io Person API Error:', error);

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
