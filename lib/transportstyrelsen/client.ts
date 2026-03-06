/**
 * lib/transportstyrelsen/client.ts
 *
 * Transportstyrelsen e-tjänst API client.
 * Docs: https://www.transportstyrelsen.se/sv/om-oss/e-tjanster-och-appar/api-portalen/
 *
 * Required env vars:
 *   TRANSPORTSTYRELSEN_API_URL   Default: https://eap.transportstyrelsen.se/eap-api/v1
 *   TRANSPORTSTYRELSEN_API_KEY   API key from the Transportstyrelsen API portal
 *
 * Notes:
 *   - Vehicle lookup is available for registered API consumers.
 *   - Ownership transfer (ägarbyte) requires BankID authorisation by both
 *     seller and buyer — this API initiates the digital process and returns
 *     a signing URL. The actual transfer is completed in Transportstyrelsen's
 *     e-tjänst when both parties sign.
 *   - Test environment uses the same base URL with test API keys.
 *     Register at: https://eap.transportstyrelsen.se
 */

const BASE = process.env.TRANSPORTSTYRELSEN_API_URL ?? 'https://eap.transportstyrelsen.se/eap-api/v1';

function headers(apiKey: string) {
  return {
    'x-api-key':    apiKey,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VehicleData {
  registrationNumber: string;
  vin:                string;
  make:               string;
  model:              string;
  modelYear:          number;
  color:              string;
  fuelType:           string;
  bodyType:           string;
  engineDisplacement: number;   // cc
  maxPower:           number;   // kW
  vehicleType:        string;   // 'MOTORCYCLE' | 'MOPED' | 'CAR' | ...
  status:             'REGISTERED' | 'DEREGISTERED' | 'STOLEN' | 'SCRAPPED';
  taxClass:           string;
  lastInspection:     string | null;  // ISO date
  nextInspection:     string | null;  // ISO date
  ownerName:          string;
  ownerCity:          string;
  liens:              boolean;        // true if there are outstanding liens
}

export interface OwnershipTransferRequest {
  registrationNumber: string;
  sellerPersonNumber: string;  // Swedish personnummer YYYYMMDDXXXX
  buyerPersonNumber:  string;
  purchaseDate:       string;  // ISO date
  purchasePrice:      number;  // SEK
  odometerReading:    number;  // km
}

export interface OwnershipTransferResponse {
  caseId:     string;   // Ärendenummer
  status:     'INITIATED' | 'PENDING_SELLER' | 'PENDING_BUYER' | 'COMPLETED' | 'REJECTED';
  signingUrl: string;   // BankID signing URL for both parties
  expiresAt:  string;   // ISO datetime — signing window
}

// ─── Vehicle lookup ───────────────────────────────────────────────────────────

export async function lookupVehicle(
  apiKey:             string,
  registrationNumber: string,
): Promise<VehicleData> {
  const regNr = registrationNumber.toUpperCase().replace(/\s/g, '');
  const res = await fetch(`${BASE}/vehicles/${encodeURIComponent(regNr)}`, {
    headers: headers(apiKey),
  });
  if (res.status === 404) {
    throw new Error(`Vehicle ${regNr} not found in Fordonsregistret`);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Transportstyrelsen lookupVehicle ${res.status}: ${err}`);
  }
  return res.json() as Promise<VehicleData>;
}

// ─── Ownership transfer ───────────────────────────────────────────────────────

export async function initiateOwnershipTransfer(
  apiKey:  string,
  payload: OwnershipTransferRequest,
): Promise<OwnershipTransferResponse> {
  const res = await fetch(`${BASE}/ownership-transfers`, {
    method:  'POST',
    headers: headers(apiKey),
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Transportstyrelsen ownershipTransfer ${res.status}: ${err}`);
  }
  return res.json() as Promise<OwnershipTransferResponse>;
}

export async function getOwnershipTransferStatus(
  apiKey:  string,
  caseId:  string,
): Promise<OwnershipTransferResponse> {
  const res = await fetch(`${BASE}/ownership-transfers/${encodeURIComponent(caseId)}`, {
    headers: headers(apiKey),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Transportstyrelsen getTransferStatus ${res.status}: ${err}`);
  }
  return res.json() as Promise<OwnershipTransferResponse>;
}

// ─── Connection test ──────────────────────────────────────────────────────────

export async function testConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { headers: headers(apiKey) });
    // 401 = key invalid, 200/404 = API reachable (404 means no /health endpoint but auth passed)
    return res.status !== 401 && res.status !== 403;
  } catch {
    return false;
  }
}
