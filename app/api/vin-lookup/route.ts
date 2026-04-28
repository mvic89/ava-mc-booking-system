// ─── GET /api/vin-lookup?vin=XXXXXXXXXXXXXXXXX ─────────────────────────────────
// Server-side VIN decoder — keeps API keys out of the browser.
//
// Strategy:
//   1. Bilvision  — Swedish vehicle data (make, model, year, color, owner data).
//      Requires BILVISION_API_KEY env var.
//   2. NHTSA vPIC — Free US NHTSA global VIN database. No key required.
//      Used as primary when no Bilvision key is set, or as fallback for non-Swedish VINs.
//
// Returns a unified VehicleLookupResult shape regardless of source.

import { NextRequest, NextResponse } from 'next/server';
import { bilvisionByVin } from '@/lib/bilvision/client';

export interface VehicleLookupResult {
  make:        string;
  model:       string;
  year:        number;
  color:       string;
  bodyClass:   string;
  fuelType:    string;
  engineCC:    number;
  source:      'bilvision' | 'nhtsa' | 'not_found';
}

const EMPTY: VehicleLookupResult = {
  make: '', model: '', year: 0, color: '', bodyClass: '', fuelType: '', engineCC: 0,
  source: 'not_found',
};

// ── NHTSA vPIC (free global fallback) ─────────────────────────────────────────

async function lookupNHTSA(vin: string): Promise<VehicleLookupResult | null> {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    const r    = json?.Results?.[0];
    if (!r) return null;

    const make  = (r.Make ?? '') as string;
    const model = (r.Model ?? '') as string;
    const year  = parseInt(String(r.ModelYear ?? '0'), 10) || 0;

    if (!make && !model) return null;

    const rawBody   = (r.BodyClass ?? r.VehicleType ?? '') as string;
    const bodyClass = rawBody.toLowerCase().includes('motorcycle') ? 'Motorcykel'
      : rawBody.toLowerCase().includes('moped') ? 'Moped'
      : rawBody;

    const fuelType = (r.FuelTypePrimary ?? '') as string;
    const engineCC = Math.round(parseFloat(String(r.DisplacementCC ?? '0')) || 0);

    return { make, model, year, color: '', bodyClass, fuelType, engineCC, source: 'nhtsa' };
  } catch {
    return null;
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const vin = req.nextUrl.searchParams.get('vin')?.trim().toUpperCase() ?? '';

  if (!vin || vin.length < 11) {
    return NextResponse.json({ error: 'VIN too short' }, { status: 400 });
  }

  // Try Bilvision first — richer Swedish data including color
  const bv = await bilvisionByVin(vin);
  if (bv) {
    return NextResponse.json({
      make:      bv.make,
      model:     bv.model,
      year:      bv.year,
      color:     bv.color,
      bodyClass: bv.bodyType,
      fuelType:  bv.fuelType,
      engineCC:  bv.engineCC,
      source:    'bilvision',
    } satisfies VehicleLookupResult);
  }

  // Fallback: NHTSA (free, global, no color/owner data)
  const nhtsa = await lookupNHTSA(vin);
  if (nhtsa) return NextResponse.json(nhtsa);

  return NextResponse.json(EMPTY);
}
