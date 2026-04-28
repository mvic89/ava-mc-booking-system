import { NextRequest, NextResponse } from 'next/server';
import { getQuoteLF, getQuoteTryggHansa } from '@/lib/insurance/client';
import type { InsuranceQuoteRequest } from '@/lib/insurance/client';
import { getCredential } from '@/lib/integrations/config-store';

/**
 * POST /api/insurance/quote
 *
 * Request MC insurance quotes from all enabled providers simultaneously.
 * Returns an array of quotes sorted by monthly premium (lowest first).
 *
 * Body: {
 *   dealerId:          string
 *   customerSSN:       string        ← YYYYMMDDXXXX
 *   vehicleRegNumber?: string
 *   vin?:              string
 *   make:              string
 *   model:             string
 *   modelYear:         number
 *   annualMileage:     number        ← km
 *   garagePostalCode:  string
 *   coverageType:      'TRAFFIC' | 'HALF_COVERAGE' | 'FULL_COVERAGE'
 *   bonusClass?:       number        ← 0–14
 *   startDate:         string        ← ISO date
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as InsuranceQuoteRequest & { dealerId: string };
    const dealerId = body.dealerId ?? 'ava-mc';

    const payload: InsuranceQuoteRequest = {
      customerSSN:        body.customerSSN,
      vehicleRegNumber:   body.vehicleRegNumber,
      vin:                body.vin,
      make:               body.make,
      model:              body.model,
      modelYear:          body.modelYear,
      annualMileage:      body.annualMileage,
      garagePostalCode:   body.garagePostalCode,
      coverageType:       body.coverageType,
      bonusClass:         body.bonusClass,
      startDate:          body.startDate,
    };

    const tasks: Promise<unknown>[] = [];

    // Länsförsäkringar
    const lfKey  = await getCredential(dealerId, 'lansforsakringar', 'LF_API_KEY');
    const lfPid  = await getCredential(dealerId, 'lansforsakringar', 'LF_PARTNER_ID');
    const lfUrl  = await getCredential(dealerId, 'lansforsakringar', 'LF_API_URL') || 'https://api.lansforsakringar.se/partner/v1';
    if (lfKey && lfPid) {
      tasks.push(
        getQuoteLF(lfKey, lfPid, lfUrl, payload).catch(e => ({ error: e.message, provider: 'lansforsakringar' })),
      );
    }

    // Trygg-Hansa
    const thKey  = await getCredential(dealerId, 'trygg_hansa', 'TRYGG_HANSA_API_KEY');
    const thBid  = await getCredential(dealerId, 'trygg_hansa', 'TRYGG_HANSA_BROKER_ID');
    const thUrl  = await getCredential(dealerId, 'trygg_hansa', 'TRYGG_HANSA_API_URL') || 'https://api-test.trygghansa.se/partner/v2';
    if (thKey && thBid) {
      tasks.push(
        getQuoteTryggHansa(thKey, thBid, thUrl, payload).catch(e => ({ error: e.message, provider: 'trygg_hansa' })),
      );
    }

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'No insurance providers are configured' }, { status: 400 });
    }

    const results = await Promise.all(tasks);
    const quotes  = results.filter((r: any) => !r.error);
    const errors  = results.filter((r: any) => r.error);

    // Sort by monthly premium ascending
    quotes.sort((a: any, b: any) => (a.monthlyPremium ?? 0) - (b.monthlyPremium ?? 0));

    return NextResponse.json({ quotes, errors: errors.length > 0 ? errors : undefined });
  } catch (error: any) {
    console.error('[insurance/quote POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
