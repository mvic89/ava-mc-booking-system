import { NextRequest, NextResponse } from 'next/server';
import { createAd } from '@/lib/blocket/client';
import { getCredential } from '@/lib/integrations/config-store';

/**
 * POST /api/blocket/ad
 *
 * Create a new Blocket listing for a vehicle in inventory.
 *
 * Body: {
 *   dealerId:    string
 *   subject:     string       ← Ad title, e.g. "Kawasaki Ninja ZX-6R 2024"
 *   body:        string       ← Description
 *   price:       number       ← SEK
 *   location: { zip, city, region }
 *   parameters: { make, model, model_year, mileage, vin?, color?, fuel_type?, body_type? }
 *   images?:     { url, alt }[]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealerId:   string;
      subject:    string;
      body:       string;
      price:      number;
      location:   { zip: string; city: string; region: string };
      parameters: {
        make:       string;
        model:      string;
        model_year: number;
        mileage:    number;
        vin?:       string;
        color?:     string;
        fuel_type?: string;
        body_type?: string;
      };
      images?: { url: string; alt?: string }[];
    };

    const dealerId  = body.dealerId ?? 'ava-mc';
    const apiKey    = await getCredential(dealerId, 'blocket', 'BLOCKET_API_KEY');
    const accountId = await getCredential(dealerId, 'blocket', 'BLOCKET_ACCOUNT_ID');

    if (!apiKey || !accountId) {
      return NextResponse.json({ error: 'Blocket credentials not configured' }, { status: 400 });
    }

    const ad = await createAd(apiKey, accountId, {
      subject:     body.subject,
      body:        body.body,
      price:       body.price,
      category_id: 'mc',
      location:    body.location,
      parameters:  body.parameters,
      images:      body.images,
    });

    return NextResponse.json({ ad });
  } catch (error: any) {
    console.error('[blocket/ad POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
