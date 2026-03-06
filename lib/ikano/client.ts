/**
 * Ikano Bank — Credit API Client
 *
 * Product: Consumer credit and installment loans for vehicle purchases
 * Docs:    https://www.ikanobank.se/foretag/
 * Auth:    X-Api-Key header (API key issued after partner agreement)
 *
 * ⚠️  Ikano Bank's merchant/POS financing API requires a private commercial agreement.
 *     Their only publicly documented API is PSD2/XS2A (account access for licensed TPPs).
 *     Contact Ikano Bank to request merchant/partner API access.
 *
 * Environments:
 *   Test:       Provisioned per merchant by Ikano (no public URL)
 *   Production: https://api.ikanobank.se  (base URL — confirmed from PSD2 portal)
 *
 * Required env vars:
 *   IKANO_API_KEY  – API key from Ikano Bank partner portal
 *   IKANO_STORE_ID – Your Store ID assigned by Ikano
 *   IKANO_API_URL  – Base URL (defaults to production — replace with test URL when provided)
 */

const BASE_URL = process.env.IKANO_API_URL  ?? 'https://api.ikanobank.se';
const API_KEY  = process.env.IKANO_API_KEY  ?? '';
const STORE_ID = process.env.IKANO_STORE_ID ?? '';

async function ikanoFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key':    API_KEY,
      'X-Store-Id':   STORE_ID,
      Accept:         'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ikano ${res.status} ${res.statusText}: ${body}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IkanoApplicant {
  personalNumber: string;   // Swedish personnummer e.g. "199001011234"
  firstName:      string;
  lastName:       string;
  email:          string;
  phone:          string;
  address: {
    street:     string;
    postalCode: string;
    city:       string;
    country:    string;   // 'SE'
  };
}

export interface IkanoProduct {
  articleNumber: string;
  description:   string;
  quantity:      number;
  unitPrice:     number;    // in SEK including VAT
  vatPercent:    number;    // e.g. 25
}

export interface IkanoApplicationRequest {
  storeId:       string;
  orderReference: string;
  applicant:     IkanoApplicant;
  products:      IkanoProduct[];
  loanAmount:    number;         // in SEK
  downPayment:   number;         // in SEK
  campaignCode?: string;         // installment plan code
  callbackUrl?:  string;
}

export interface IkanoApplicationResponse {
  applicationId: string;
  status:        'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'SIGNED';
  signingUrl?:   string;          // BankID signing link for customer
  monthlyAmount?: number;
  totalAmount?:   number;
  interestRate?:  number;
  campaign?: {
    code:        string;
    description: string;
    months:      number;
  };
  createdAt: string;
}

export interface IkanoCampaign {
  code:           string;
  description:    string;
  months:         number;
  interestRate:   number;
  effectiveRate:  number;
  minAmount:      number;
  maxAmount:      number;
}

export interface IkanoStore {
  storeId:   string;
  storeName: string;
  currency:  string;
  country:   string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Get store configuration and available campaigns.
 */
export async function getStore(): Promise<IkanoStore> {
  return ikanoFetch<IkanoStore>(`/credit/v1/stores/${STORE_ID}`);
}

/**
 * List available installment campaigns for a given purchase amount.
 */
export async function getCampaigns(amount: number): Promise<IkanoCampaign[]> {
  return ikanoFetch<IkanoCampaign[]>(
    `/credit/v1/stores/${STORE_ID}/campaigns?amount=${amount}`,
  );
}

/**
 * Create a new credit application.
 * Returns signingUrl — send this to the customer for BankID signing.
 */
export async function createApplication(
  params: IkanoApplicationRequest,
): Promise<IkanoApplicationResponse> {
  return ikanoFetch<IkanoApplicationResponse>('/credit/v1/applications', {
    method: 'POST',
    body:   JSON.stringify({ ...params, storeId: STORE_ID }),
  });
}

/**
 * Get the status of an existing application.
 */
export async function getApplication(applicationId: string): Promise<IkanoApplicationResponse> {
  return ikanoFetch<IkanoApplicationResponse>(`/credit/v1/applications/${applicationId}`);
}

/**
 * Cancel an application (before signing).
 */
export async function cancelApplication(applicationId: string): Promise<void> {
  await ikanoFetch(`/credit/v1/applications/${applicationId}/cancel`, { method: 'POST' });
}

/**
 * Activate/deliver the credit after the vehicle is handed over.
 * Triggers payout from Ikano Bank to the dealership.
 */
export async function activateApplication(applicationId: string): Promise<void> {
  await ikanoFetch(`/credit/v1/applications/${applicationId}/activate`, { method: 'POST' });
}

/**
 * Refund a finalized application (partial or full).
 */
export async function refundApplication(
  applicationId: string,
  amount: number,
  reason?: string,
): Promise<{ refundId: string; status: string }> {
  return ikanoFetch(`/credit/v1/applications/${applicationId}/refund`, {
    method: 'POST',
    body:   JSON.stringify({ amount, reason }),
  });
}
