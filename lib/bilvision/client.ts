/**
 * lib/bilvision/client.ts
 *
 * Bilvision vehicle data API client (Swedish).
 * Purpose-built for Swedish dealerships — single API call returns vehicle details,
 * registered owner, liens/skulder, inspection dates, mileage history, and insurance status.
 *
 * Docs / sign-up: https://www.bilvision.se/api
 *
 * Required env vars:
 *   BILVISION_API_KEY   — API key from your Bilvision account
 *   BILVISION_API_URL   — Default: https://api.bilvision.se/api/v1
 *
 * ⚠️  Field-name verification:
 *   The response field names below are based on Bilvision's documented API schema.
 *   If any field returns undefined after integration, cross-check against the
 *   Swagger/OpenAPI spec available in your Bilvision developer portal.
 *
 * Lookup strategy used by /api/vehicle-lookup:
 *   1. Bilvision by reg nr  — full data (owner + liens + inspection) in one call
 *   2. Bilvision by VIN     — vehicle specs + partial Swedish data
 *   3. NHTSA vPIC (free)   — global VIN fallback, no owner/lien data
 */

const BASE = process.env.BILVISION_API_URL ?? 'https://api.bilvision.se/api/v1';

function authHeaders() {
  return {
    'X-API-Key':    process.env.BILVISION_API_KEY ?? '',
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };
}

// ─── Response types (Bilvision schema) ────────────────────────────────────────

// These match Bilvision's documented response structure.
// ⚠️ Verify field names against your API tier's Swagger docs.

export interface BilvisionVehicleResponse {
  vehicle: {
    registrationNumber:  string;   // e.g. "ABC123"
    vin:                 string;
    make:                string;   // e.g. "HONDA"
    model:               string;   // e.g. "CB500F"
    modelYear:           number;   // e.g. 2020
    color:               string;   // e.g. "Röd"
    bodyType:            string;   // e.g. "Motorcykel" | "Moped" | "Personbil"
    fuelType:            string;   // e.g. "Bensin" | "El" | "Diesel"
    engineVolume:        number;   // cc, e.g. 471
    mileage:             number;   // latest odometer reading in km
    lastMileageDate:     string;   // ISO date of latest odometer reading
    status:              string;   // "REGISTERED" | "DEREGISTERED" | "STOLEN" | "SCRAPPED"
    taxClass:            string;
  };
  owner: {
    firstName:           string;
    lastName:            string;
    address:             string;
    postalCode:          string;
    city:                string;
    isCompany:           boolean;
    companyName:         string;   // set when isCompany = true
  };
  financial: {
    hasLien:             boolean;  // true = skuld registrerad på fordonet
    lienHolder:          string;   // kreditgivare e.g. "Santander Consumer Bank"
    lienAmount:          number;   // SEK
  };
  inspection: {
    lastInspectionDate:  string;   // ISO date
    nextInspectionDate:  string;   // ISO date
    inspectionStatus:    string;   // "APPROVED" | "FAILED" | "NOT_REQUIRED"
  };
  insurance: {
    hasInsurance:        boolean;
    insurer:             string;
    validUntil:          string;   // ISO date
  };
}

// ─── Normalised output ────────────────────────────────────────────────────────

export interface BilvisionResult {
  // Vehicle
  registrationNumber:  string;
  vin:                 string;
  make:                string;
  model:               string;
  year:                number;
  color:               string;
  bodyType:            string;
  fuelType:            string;
  engineCC:            number;
  // Odometer
  mileage:             number;
  mileageUnit:         'km';
  // Status
  vehicleStatus:       'REGISTERED' | 'STOLEN' | 'SCRAPPED' | 'DEREGISTERED' | 'UNKNOWN';
  // Owner
  ownerName:           string;   // firstName + lastName (or companyName)
  ownerFirstName:      string;
  ownerLastName:       string;
  ownerAddress:        string;
  ownerZip:            string;
  ownerCity:           string;
  ownerIsCompany:      boolean;
  // Liens
  liens:               boolean;
  lienHolder:          string;
  lienAmount:          number;
  // Inspection
  lastInspection:      string;
  nextInspection:      string;
  inspectionStatus:    string;
  // Insurance
  hasInsurance:        boolean;
  insurer:             string;
  // Meta
  source:              'bilvision';
}

function normaliseStatus(raw: string): BilvisionResult['vehicleStatus'] {
  const map: Record<string, BilvisionResult['vehicleStatus']> = {
    REGISTERED:   'REGISTERED',
    DEREGISTERED: 'DEREGISTERED',
    STOLEN:       'STOLEN',
    SCRAPPED:     'SCRAPPED',
    registrerad:  'REGISTERED',
    avregistrerad:'DEREGISTERED',
    stulen:       'STOLEN',
    skrotad:      'SCRAPPED',
  };
  return map[raw?.trim()] ?? 'UNKNOWN';
}

function titleCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

function normalise(raw: BilvisionVehicleResponse): BilvisionResult {
  const v  = raw.vehicle   ?? {};
  const o  = raw.owner     ?? {};
  const f  = raw.financial ?? {};
  const i  = raw.inspection ?? {};
  const ins = raw.insurance ?? {};

  const firstName   = titleCase(o.firstName  ?? '');
  const lastName    = titleCase(o.lastName   ?? '');
  const ownerName   = o.isCompany
    ? (o.companyName ?? '')
    : [firstName, lastName].filter(Boolean).join(' ');

  const rawColor = (v.color ?? '') as string;
  const color    = titleCase(rawColor.replace(/\s?enfärgad/i, '').trim());

  return {
    registrationNumber: v.registrationNumber ?? '',
    vin:                v.vin                ?? '',
    make:               titleCase(v.make     ?? ''),
    model:              v.model              ?? '',
    year:               v.modelYear          ?? 0,
    color,
    bodyType:           v.bodyType           ?? '',
    fuelType:           v.fuelType           ?? '',
    engineCC:           v.engineVolume       ?? 0,
    mileage:            v.mileage            ?? 0,
    mileageUnit:        'km',
    vehicleStatus:      normaliseStatus(v.status ?? ''),
    ownerName,
    ownerFirstName:     firstName,
    ownerLastName:      lastName,
    ownerAddress:       o.address            ?? '',
    ownerZip:           o.postalCode         ?? '',
    ownerCity:          titleCase(o.city     ?? ''),
    ownerIsCompany:     o.isCompany          ?? false,
    liens:              f.hasLien            ?? false,
    lienHolder:         f.lienHolder         ?? '',
    lienAmount:         f.lienAmount         ?? 0,
    lastInspection:     i.lastInspectionDate ?? '',
    nextInspection:     i.nextInspectionDate ?? '',
    inspectionStatus:   i.inspectionStatus   ?? '',
    hasInsurance:       ins.hasInsurance     ?? false,
    insurer:            ins.insurer          ?? '',
    source:             'bilvision',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function isBilvisionConfigured() {
  const key = process.env.BILVISION_API_KEY ?? '';
  return key.length > 0 && key !== 'your_bilvision_api_key_here';
}

/**
 * Look up a vehicle by Swedish registration number.
 * Returns full data: vehicle + owner + liens + inspection + insurance.
 */
export async function bilvisionByRegNr(regNr: string): Promise<BilvisionResult | null> {
  if (!isBilvisionConfigured()) return null;

  try {
    const cleaned = regNr.toUpperCase().replace(/\s/g, '');
    const res = await fetch(
      `${BASE}/vehicles/${encodeURIComponent(cleaned)}`,
      { headers: authHeaders(), signal: AbortSignal.timeout(6000) },
    );

    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[bilvision] regNr lookup ${res.status} for ${cleaned}`);
      return null;
    }

    const json = await res.json() as BilvisionVehicleResponse;
    if (!json?.vehicle?.make && !json?.vehicle?.model) return null;
    return normalise(json);
  } catch (err) {
    console.warn('[bilvision] regNr lookup error:', err);
    return null;
  }
}

/**
 * Look up a vehicle by VIN.
 * Returns vehicle data; owner/lien data may be less complete than reg nr lookup.
 */
export async function bilvisionByVin(vin: string): Promise<BilvisionResult | null> {
  if (!isBilvisionConfigured()) return null;

  try {
    const res = await fetch(
      `${BASE}/vehicles/vin/${encodeURIComponent(vin.toUpperCase())}`,
      { headers: authHeaders(), signal: AbortSignal.timeout(6000) },
    );

    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[bilvision] VIN lookup ${res.status} for ${vin}`);
      return null;
    }

    const json = await res.json() as BilvisionVehicleResponse;
    if (!json?.vehicle?.make && !json?.vehicle?.model) return null;
    return normalise(json);
  } catch (err) {
    console.warn('[bilvision] VIN lookup error:', err);
    return null;
  }
}
