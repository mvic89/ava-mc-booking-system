/**
 * lib/insurance/client.ts
 *
 * Multi-provider MC insurance client.
 * Supports Länsförsäkringar and Trygg-Hansa via their respective partner APIs.
 *
 * Flow:
 *   1. getQuote(provider, payload) → returns InsuranceQuote[]
 *   2. Admin/salesperson presents quote to customer
 *   3. bindPolicy(provider, quoteId, customerSSN) → returns InsurancePolicy
 *
 * Required env vars per provider:
 *   LF (Länsförsäkringar):
 *     LF_API_KEY         API key from LF partner portal
 *     LF_PARTNER_ID      Partner ID assigned by LF
 *     LF_API_URL         Default: https://api.lansforsakringar.se/partner/v1
 *
 *   TRYGG_HANSA:
 *     TRYGG_HANSA_API_KEY      Broker API key
 *     TRYGG_HANSA_BROKER_ID    Broker ID
 *     TRYGG_HANSA_API_URL      Default: https://api-test.trygghansa.se/partner/v2
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsuranceProvider = 'lansforsakringar' | 'trygg_hansa';

export interface InsuranceQuoteRequest {
  /** Swedish personnummer: YYYYMMDDXXXX */
  customerSSN:         string;
  vehicleRegNumber?:   string;
  vin?:                string;
  make:                string;
  model:               string;
  modelYear:           number;
  annualMileage:       number;      // km
  garagePostalCode:    string;
  coverageType:        'TRAFFIC' | 'HALF_COVERAGE' | 'FULL_COVERAGE';
  bonusClass?:         number;      // 0–14, motor insurance bonus class
  startDate:           string;      // ISO date
}

export interface InsuranceQuote {
  provider:     InsuranceProvider;
  quoteId:      string;
  coverageType: string;
  monthlyPremium: number;       // SEK/month
  annualPremium:  number;       // SEK/year
  deductible:     number;       // SEK
  validUntil:     string;       // ISO datetime
  coverageDetails: string[];    // Human-readable list of what's covered
}

export interface InsurancePolicy {
  provider:      InsuranceProvider;
  policyNumber:  string;
  status:        'ACTIVE' | 'PENDING' | 'FAILED';
  startDate:     string;
  monthlyPremium: number;
  message?:      string;
}

// ─── Länsförsäkringar ─────────────────────────────────────────────────────────

async function lfHeaders(apiKey: string, partnerId: string) {
  return {
    'X-Api-Key':    apiKey,
    'X-Partner-Id': partnerId,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };
}

export async function getQuoteLF(
  apiKey:    string,
  partnerId: string,
  apiUrl:    string,
  payload:   InsuranceQuoteRequest,
): Promise<InsuranceQuote> {
  const base = apiUrl || 'https://api.lansforsakringar.se/partner/v1';
  const res = await fetch(`${base}/motor/quotes`, {
    method:  'POST',
    headers: await lfHeaders(apiKey, partnerId),
    body: JSON.stringify({
      personnummer:      payload.customerSSN,
      registreringsNr:   payload.vehicleRegNumber ?? '',
      fordon: {
        marke:       payload.make,
        modell:      payload.model,
        arsmodell:   payload.modelYear,
        fordonTyp:   'MC',
      },
      arligKorning:    payload.annualMileage,
      garagePostkod:   payload.garagePostalCode,
      skyddsklass:     payload.coverageType === 'FULL_COVERAGE' ? 'HELFORSAKRING'
                      : payload.coverageType === 'HALF_COVERAGE' ? 'HALVFORSAKRING'
                      : 'TRAFIK',
      bonusMalus:      payload.bonusClass ?? 0,
      startDatum:      payload.startDate,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Länsförsäkringar quote ${res.status}: ${err}`);
  }
  const data = await res.json() as {
    offertId:        string;
    manadsKostnad:   number;
    arsKostnad:      number;
    sjalvrisk:       number;
    giltigTill:      string;
    skydd:           string[];
  };
  return {
    provider:       'lansforsakringar',
    quoteId:        data.offertId,
    coverageType:   payload.coverageType,
    monthlyPremium: data.manadsKostnad,
    annualPremium:  data.arsKostnad,
    deductible:     data.sjalvrisk,
    validUntil:     data.giltigTill,
    coverageDetails: data.skydd,
  };
}

export async function bindPolicyLF(
  apiKey:      string,
  partnerId:   string,
  apiUrl:      string,
  quoteId:     string,
  customerSSN: string,
): Promise<InsurancePolicy> {
  const base = apiUrl || 'https://api.lansforsakringar.se/partner/v1';
  const res = await fetch(`${base}/motor/policies`, {
    method:  'POST',
    headers: await lfHeaders(apiKey, partnerId),
    body: JSON.stringify({ offertId: quoteId, personnummer: customerSSN }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Länsförsäkringar bindPolicy ${res.status}: ${err}`);
  }
  const data = await res.json() as {
    forsakringsNummer: string;
    status:            string;
    startDatum:        string;
    manadsKostnad:     number;
    meddelande?:       string;
  };
  return {
    provider:       'lansforsakringar',
    policyNumber:   data.forsakringsNummer,
    status:         data.status === 'AKTIV' ? 'ACTIVE' : 'PENDING',
    startDate:      data.startDatum,
    monthlyPremium: data.manadsKostnad,
    message:        data.meddelande,
  };
}

// ─── Trygg-Hansa ──────────────────────────────────────────────────────────────

export async function getQuoteTryggHansa(
  apiKey:    string,
  brokerId:  string,
  apiUrl:    string,
  payload:   InsuranceQuoteRequest,
): Promise<InsuranceQuote> {
  const base = apiUrl || 'https://api-test.trygghansa.se/partner/v2';
  const res = await fetch(`${base}/quotes/motorcycle`, {
    method:  'POST',
    headers: {
      'X-Api-Key':   apiKey,
      'X-Broker-Id': brokerId,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify({
      customer: { personalNumber: payload.customerSSN },
      vehicle: {
        registrationNumber: payload.vehicleRegNumber ?? '',
        make:       payload.make,
        model:      payload.model,
        modelYear:  payload.modelYear,
      },
      coverage:     payload.coverageType,
      annualMileage: payload.annualMileage,
      postalCode:   payload.garagePostalCode,
      startDate:    payload.startDate,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Trygg-Hansa quote ${res.status}: ${err}`);
  }
  const data = await res.json() as {
    quoteId:         string;
    monthlyPremium:  number;
    annualPremium:   number;
    deductible:      number;
    expiresAt:       string;
    coverages:       string[];
  };
  return {
    provider:       'trygg_hansa',
    quoteId:        data.quoteId,
    coverageType:   payload.coverageType,
    monthlyPremium: data.monthlyPremium,
    annualPremium:  data.annualPremium,
    deductible:     data.deductible,
    validUntil:     data.expiresAt,
    coverageDetails: data.coverages,
  };
}

// ─── Multi-provider quote helper ──────────────────────────────────────────────

export async function getQuotesFromAllProviders(
  providers: Array<{
    id:       InsuranceProvider;
    apiKey:   string;
    secondId: string;
    apiUrl:   string;
  }>,
  payload: InsuranceQuoteRequest,
): Promise<InsuranceQuote[]> {
  const results = await Promise.allSettled(
    providers.map(p => {
      if (p.id === 'lansforsakringar') {
        return getQuoteLF(p.apiKey, p.secondId, p.apiUrl, payload);
      }
      return getQuoteTryggHansa(p.apiKey, p.secondId, p.apiUrl, payload);
    }),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<InsuranceQuote> => r.status === 'fulfilled')
    .map(r => r.value);
}
