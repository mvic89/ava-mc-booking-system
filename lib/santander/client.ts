/**
 * Santander Consumer Bank Sweden — API Client
 *
 * Product: Auto e-Commerce (vehicle financing quotations + checkout links)
 * Docs:    https://developer.santanderconsumer.se/our-open-apis/autoe-commerceapis
 * Auth:    OAuth2 Bearer token (requires signed merchant agreement for sandbox access)
 *
 * ⚠️  Sandbox access is NOT self-service.
 *     Contact open.banking@santanderconsumer.no to request credentials.
 *
 * Environments:
 *   Test:       Provided by Santander after agreement signing (no public URL)
 *   Production: Provided by Santander after agreement signing
 *
 * Required env vars:
 *   SANTANDER_API_KEY    – Bearer token / API key from Santander
 *   SANTANDER_PARTNER_ID – Your assigned Partner ID
 *   SANTANDER_API_URL    – Base URL (provided by Santander, defaults to placeholder)
 */

const API_URL    = process.env.SANTANDER_API_URL    ?? 'https://api.santanderconsumer.se/v1';
const API_KEY    = process.env.SANTANDER_API_KEY    ?? '';
const PARTNER_ID = process.env.SANTANDER_PARTNER_ID ?? '';

async function santanderFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${API_KEY}`,
      'X-Partner-Id':  PARTNER_ID,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Santander ${res.status} ${res.statusText}: ${body}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SantanderApplicant {
  personalNumber: string;   // Swedish personnummer, e.g. "199001011234"
  firstName:      string;
  lastName:       string;
  email:          string;
  phone:          string;
}

export interface SantanderVehicle {
  registrationNumber?: string;
  make:                string;
  model:               string;
  year:                number;
  mileage?:            number;
  price:               number;   // in SEK
}

export interface SantanderApplicationRequest {
  merchantOrderId: string;       // your internal reference
  applicant:       SantanderApplicant;
  vehicle:         SantanderVehicle;
  loanAmount:      number;       // in SEK
  downPayment:     number;       // in SEK
  loanTermMonths:  number;       // e.g. 36, 48, 60
  callbackUrl?:    string;       // webhook URL for status updates
}

export interface SantanderApplicationResponse {
  applicationId: string;
  status:        'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  signingUrl?:   string;        // BankID signing URL sent to customer
  monthlyAmount?: number;       // calculated monthly payment in SEK
  totalAmount?:   number;       // total repayment in SEK
  interestRate?:  number;       // APR as decimal, e.g. 0.0699 = 6.99%
  createdAt:      string;
}

export interface SantanderRefundRequest {
  applicationId: string;
  amount:        number;        // in SEK
  reason?:       string;
}

export interface SantanderRefundResponse {
  refundId:   string;
  status:     'PENDING' | 'COMPLETED' | 'FAILED';
  amount:     number;
  processedAt?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Create a new financing application for a customer.
 * Returns a signingUrl — send this to the customer via SMS/email for BankID signing.
 */
export async function createApplication(
  params: SantanderApplicationRequest,
): Promise<SantanderApplicationResponse> {
  return santanderFetch<SantanderApplicationResponse>(
    `/partner/${PARTNER_ID}/applications`,
    { method: 'POST', body: JSON.stringify(params) },
  );
}

/**
 * Poll the status of an existing application.
 * Call this after the customer completes BankID signing.
 */
export async function getApplication(
  applicationId: string,
): Promise<SantanderApplicationResponse> {
  return santanderFetch<SantanderApplicationResponse>(
    `/partner/${PARTNER_ID}/applications/${applicationId}`,
  );
}

/**
 * Cancel a pending application (before it is signed).
 */
export async function cancelApplication(applicationId: string): Promise<void> {
  await santanderFetch(
    `/partner/${PARTNER_ID}/applications/${applicationId}/cancel`,
    { method: 'POST' },
  );
}

/**
 * Refund a completed financing application (after delivery).
 */
export async function refundApplication(
  params: SantanderRefundRequest,
): Promise<SantanderRefundResponse> {
  const { applicationId, ...body } = params;
  return santanderFetch<SantanderRefundResponse>(
    `/partner/${PARTNER_ID}/applications/${applicationId}/refund`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

/**
 * List all applications for this partner (paginated).
 */
export async function listApplications(opts?: {
  page?:   number;
  limit?:  number;
  status?: SantanderApplicationResponse['status'];
}): Promise<{ items: SantanderApplicationResponse[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.page)   params.set('page',   String(opts.page));
  if (opts?.limit)  params.set('limit',  String(opts.limit));
  if (opts?.status) params.set('status', opts.status);
  const qs = params.toString() ? `?${params}` : '';
  return santanderFetch(`/partner/${PARTNER_ID}/applications${qs}`);
}
