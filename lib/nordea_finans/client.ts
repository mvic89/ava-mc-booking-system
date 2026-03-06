/**
 * Nordea Finans Sverige AB — API Client
 *
 * Product: Vehicle leasing and consumer installment loans (fordonslån)
 * Docs:    https://developer.nordeaopenbanking.com/
 * Auth:    IBM API Connect (X-IBM-Client-Id + X-IBM-Client-Secret headers)
 *
 * ⚠️  Two separate products:
 *   1. Nordea Open Banking (PSD2 account access for licensed TPPs)
 *      → Base URL: https://api.nordeaopenbanking.com
 *      → Token:    POST /personal/v5/authorize/token
 *      → Requires a QSealC certificate (eIDAS) — cannot use simple client_credentials
 *
 *   2. Nordea Finans vehicle credit (leasing / installment loans)
 *      → Private commercial agreement with Nordea Finans Sverige AB
 *      → No self-service developer API — contact Nordea Finans directly
 *      → Integration URL provided after signed partner agreement
 *
 * Required env vars:
 *   NORDEA_CLIENT_ID     – Client ID from Nordea developer portal
 *   NORDEA_CLIENT_SECRET – Client secret from Nordea developer portal
 *   NORDEA_API_URL       – Base URL (defaults to Open Banking production/sandbox)
 */

const BASE_URL      = process.env.NORDEA_API_URL       ?? 'https://api.nordeaopenbanking.com';
const CLIENT_ID     = process.env.NORDEA_CLIENT_ID     ?? '';
const CLIENT_SECRET = process.env.NORDEA_CLIENT_SECRET ?? '';

// ─── OAuth2 token management ──────────────────────────────────────────────────
// Note: Nordea Open Banking requires the authorization-code flow (user redirect).
// The client_credentials flow is used here for backend-to-backend calls
// where the user has already authorized. Replace with auth-code flow as needed.

let _token: string | null = null;
let _tokenExpiry = 0;

/**
 * Exchange an authorization code for an access token.
 * Call this after the user is redirected back from the Nordea authorize endpoint.
 */
export async function exchangeCodeForToken(
  code:        string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const encoded = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE_URL}/personal/v5/authorize/token`, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${encoded}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-IBM-Client-Id': CLIENT_ID,
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Nordea token exchange ${res.status}: ${body}`);
  }

  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number };
  _token = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return data;
}

/**
 * Build the authorize URL — redirect the user here to begin OAuth2 flow.
 */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  redirectUri,
    state,
    scope:         'ACCOUNTS_BASIC ACCOUNTS_BALANCES PAYMENTS_MULTIPLE',
  });
  return `${BASE_URL}/personal/v5/authorize?${params}`;
}

async function nordeaFetch<T = unknown>(
  path:    string,
  token:   string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type':      'application/json',
      Authorization:       `Bearer ${token}`,
      'X-IBM-Client-Id':     CLIENT_ID,
      'X-IBM-Client-Secret': CLIENT_SECRET,
      'X-Nordea-Originating-Date': new Date().toUTCString(),
      'X-Nordea-Originating-Host': 'ava-mc-booking-system',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Nordea ${res.status} ${res.statusText}: ${body}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NordeaAccount {
  id:              string;
  accountNumber:   { iban: string; bban?: string };
  currency:        string;
  name?:           string;
  product?:        string;
  status:          'OPEN' | 'CLOSED';
  creditLimit?:    number;
  availableBalance?: number;
  bookedBalance?:  number;
}

export interface NordeaPaymentRequest {
  amount:                string;   // e.g. "100.00"
  currency:              string;   // 'SEK'
  creditorAccount:       { iban: string };
  creditorName:          string;
  debtorAccount:         { iban: string };
  endToEndId:            string;   // your internal reference
  message?:              string;
  paymentDate?:          string;   // ISO date, e.g. "2024-06-01"
}

export interface NordeaPaymentResponse {
  paymentId:   string;
  status:      'PENDING' | 'PROCESSING' | 'COMPLETE' | 'REJECTED';
  amount:      string;
  currency:    string;
  createdAt:   string;
}

export interface NordeaLoanApplicationRequest {
  personalNumber:    string;
  vehiclePrice:      number;    // in SEK
  downPayment:       number;    // in SEK
  loanTermMonths:    number;    // e.g. 60
  vehicleMake:       string;
  vehicleModel:      string;
  vehicleYear:       number;
  registrationNumber?: string;
}

// ─── API calls (Open Banking) ─────────────────────────────────────────────────

/**
 * List all accounts for the authenticated customer.
 */
export async function getAccounts(token: string): Promise<NordeaAccount[]> {
  const data = await nordeaFetch<{ response: { accounts: NordeaAccount[] } }>(
    '/personal/v5/accounts',
    token,
  );
  return data.response.accounts;
}

/**
 * Get account details including balances.
 */
export async function getAccount(token: string, accountId: string): Promise<NordeaAccount> {
  const data = await nordeaFetch<{ response: NordeaAccount }>(
    `/personal/v5/accounts/${accountId}`,
    token,
  );
  return data.response;
}

/**
 * Initiate a payment from the customer's account.
 */
export async function createPayment(
  token:  string,
  params: NordeaPaymentRequest,
): Promise<NordeaPaymentResponse> {
  const data = await nordeaFetch<{ response: NordeaPaymentResponse }>(
    '/personal/v5/payments/domestic',
    token,
    { method: 'POST', body: JSON.stringify(params) },
  );
  return data.response;
}

/**
 * Get payment status.
 */
export async function getPayment(
  token:     string,
  paymentId: string,
): Promise<NordeaPaymentResponse> {
  const data = await nordeaFetch<{ response: NordeaPaymentResponse }>(
    `/personal/v5/payments/domestic/${paymentId}`,
    token,
  );
  return data.response;
}

// ─── Nordea Finans vehicle credit (private agreement) ─────────────────────────

/**
 * Submit a vehicle loan application via Nordea Finans.
 *
 * ⚠️  This endpoint requires a direct commercial agreement with Nordea Finans Sverige AB.
 *     The actual URL and request format will differ — this is a placeholder matching
 *     the expected interface. Replace BASE_URL with your Nordea Finans-provided endpoint.
 */
export async function createLoanApplication(
  token:  string,
  params: NordeaLoanApplicationRequest,
): Promise<{ applicationId: string; status: string; signingUrl?: string }> {
  return nordeaFetch(
    '/finans/v1/applications/vehicle',
    token,
    { method: 'POST', body: JSON.stringify(params) },
  );
}
