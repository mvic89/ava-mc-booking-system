// ─── GET /api/vehicle-lookup?query=<VIN|REGNR> ──────────────────────────────
//
// Unified vehicle lookup — auto-detects VIN (17 chars) vs Swedish reg number.
//
// For VIN   → Bilvision (Swedish data, owner info) → NHTSA (global fallback)
// For regNr → Bilvision (full data: vehicle + owner + liens + inspection in one call)
//
// Bilvision replaces the previous two-provider setup (Biluppgifter + Transportstyrelsen),
// returning everything in a single API call.

import { NextRequest, NextResponse } from 'next/server';
import { bilvisionByRegNr, bilvisionByVin } from '@/lib/bilvision/client';

export interface VehicleLookupFull {
  // Vehicle
  make:               string;
  model:              string;
  year:               number;
  color:              string;
  bodyClass:          string;
  fuelType:           string;
  engineCC:           number;
  vin:                string;
  registrationNumber: string;
  // Owner data
  ownerName:          string;
  ownerCity:          string;
  ownerAddress:       string;
  ownerZip:           string;
  ownerIsCompany:     boolean;
  // Risk / status
  vehicleStatus:      'REGISTERED' | 'STOLEN' | 'SCRAPPED' | 'DEREGISTERED' | 'UNKNOWN';
  liens:              boolean;
  lienHolder:         string;
  lienAmount:         number;
  // Inspection
  lastInspection:     string;
  nextInspection:     string;
  inspectionStatus:   string;
  // Insurance
  hasInsurance:       boolean;
  insurer:            string;
  // Odometer
  mileage:            number;
  mileageUnit:        'km' | 'mil';
  // Meta
  source:             'bilvision' | 'nhtsa' | 'not_found';
}

const EMPTY: VehicleLookupFull = {
  make: '', model: '', year: 0, color: '', bodyClass: '', fuelType: '', engineCC: 0,
  vin: '', registrationNumber: '',
  ownerName: '', ownerCity: '', ownerAddress: '', ownerZip: '', ownerIsCompany: false,
  vehicleStatus: 'UNKNOWN', liens: false, lienHolder: '', lienAmount: 0,
  lastInspection: '', nextInspection: '', inspectionStatus: '',
  hasInsurance: false, insurer: '',
  mileage: 0, mileageUnit: 'km',
  source: 'not_found',
};

// ── NHTSA fallback (VIN only, no owner/lien data) ─────────────────────────────
async function nhtsaVin(vin: string): Promise<VehicleLookupFull | null> {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (await res.json() as any)?.Results?.[0];
    if (!r || (!r.Make && !r.Model)) return null;

    const rawBody = (r.BodyClass ?? r.VehicleType ?? '') as string;
    return {
      ...EMPTY,
      make:      r.Make  ?? '',
      model:     r.Model ?? '',
      year:      parseInt(String(r.ModelYear ?? '0'), 10) || 0,
      bodyClass: rawBody.toLowerCase().includes('motorcycle') ? 'Motorcykel'
                : rawBody.toLowerCase().includes('moped')     ? 'Moped' : rawBody,
      fuelType:  r.FuelTypePrimary ?? '',
      engineCC:  Math.round(parseFloat(String(r.DisplacementCC ?? '0')) || 0),
      vin,
      source:    'nhtsa',
    };
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('query') ?? '').trim().toUpperCase().replace(/\s+/g, '');

  if (!query || query.length < 4) {
    return NextResponse.json({ error: 'query too short' }, { status: 400 });
  }

  const isVin = query.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/i.test(query);

  if (isVin) {
    // ── VIN path ───────────────────────────────────────────────────────────
    const bv = await bilvisionByVin(query);
    if (bv) {
      return NextResponse.json({
        ...EMPTY,
        make:               bv.make,
        model:              bv.model,
        year:               bv.year,
        color:              bv.color,
        bodyClass:          bv.bodyType,
        fuelType:           bv.fuelType,
        engineCC:           bv.engineCC,
        vin:                bv.vin || query,
        registrationNumber: bv.registrationNumber,
        ownerName:          bv.ownerName,
        ownerCity:          bv.ownerCity,
        ownerAddress:       bv.ownerAddress,
        ownerZip:           bv.ownerZip,
        ownerIsCompany:     bv.ownerIsCompany,
        vehicleStatus:      bv.vehicleStatus,
        liens:              bv.liens,
        lienHolder:         bv.lienHolder,
        lienAmount:         bv.lienAmount,
        lastInspection:     bv.lastInspection,
        nextInspection:     bv.nextInspection,
        inspectionStatus:   bv.inspectionStatus,
        hasInsurance:       bv.hasInsurance,
        insurer:            bv.insurer,
        mileage:            bv.mileage,
        mileageUnit:        'km',
        source:             'bilvision',
      } satisfies VehicleLookupFull);
    }

    // Fallback: NHTSA
    const nhtsa = await nhtsaVin(query);
    if (nhtsa) return NextResponse.json(nhtsa);

    return NextResponse.json(EMPTY);
  }

  // ── Reg number path ────────────────────────────────────────────────────
  const bv = await bilvisionByRegNr(query);
  if (!bv) return NextResponse.json(EMPTY);

  return NextResponse.json({
    ...EMPTY,
    make:               bv.make,
    model:              bv.model,
    year:               bv.year,
    color:              bv.color,
    bodyClass:          bv.bodyType,
    fuelType:           bv.fuelType,
    engineCC:           bv.engineCC,
    vin:                bv.vin,
    registrationNumber: bv.registrationNumber || query,
    ownerName:          bv.ownerName,
    ownerCity:          bv.ownerCity,
    ownerAddress:       bv.ownerAddress,
    ownerZip:           bv.ownerZip,
    ownerIsCompany:     bv.ownerIsCompany,
    vehicleStatus:      bv.vehicleStatus,
    liens:              bv.liens,
    lienHolder:         bv.lienHolder,
    lienAmount:         bv.lienAmount,
    lastInspection:     bv.lastInspection,
    nextInspection:     bv.nextInspection,
    inspectionStatus:   bv.inspectionStatus,
    hasInsurance:       bv.hasInsurance,
    insurer:            bv.insurer,
    mileage:            bv.mileage,
    mileageUnit:        'km',
    source:             'bilvision',
  } satisfies VehicleLookupFull);
}
