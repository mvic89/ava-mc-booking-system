/**
 * lib/bilvision/client.ts
 *
 * Bilvision vehicle lookup stub.
 * Set BILVISION_USERNAME + BILVISION_PASSWORD in .env.local to activate.
 * When not configured, all lookups gracefully return null and the system
 * falls back to NHTSA (VIN) or returns an empty result.
 */

export interface BilvisionResult {
  registrationNumber: string;
  vin:                string;
  make:               string;
  model:              string;
  year:               number;
  color:              string;
  bodyType:           string;
  fuelType:           string;
  engineCC:           number;
  mileage:            number;
  mileageUnit:        'km';
  vehicleStatus:      'REGISTERED' | 'STOLEN' | 'SCRAPPED' | 'DEREGISTERED' | 'UNKNOWN';
  ownerName:          string;
  ownerFirstName:     string;
  ownerLastName:      string;
  ownerAddress:       string;
  ownerZip:           string;
  ownerCity:          string;
  ownerIsCompany:     boolean;
  liens:              boolean;
  lienHolder:         string;
  lienAmount:         number;
  lastInspection:     string;
  nextInspection:     string;
  inspectionStatus:   string;
  hasInsurance:       boolean;
  insurer:            string;
  source:             'bilvision';
}

export function isBilvisionConfigured(): boolean {
  const user = process.env.BILVISION_USERNAME ?? '';
  return user.length > 0;
}

export async function bilvisionByRegNr(_regNr: string): Promise<BilvisionResult | null> {
  return null;
}

export async function bilvisionByVin(_vin: string): Promise<BilvisionResult | null> {
  return null;
}
