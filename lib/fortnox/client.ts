/**
 * lib/fortnox/client.ts
 *
 * Fortnox REST API v3 client.
 * Auth: OAuth2 — Bearer access token in Authorization header.
 * Docs: https://developer.fortnox.se/
 *
 * Required env vars (or stored credentials):
 *   FORTNOX_API_URL          Base URL  (default: https://api.fortnox.se/3)
 *   FORTNOX_CLIENT_ID        OAuth2 client ID from Fortnox developer portal
 *   FORTNOX_CLIENT_SECRET    OAuth2 client secret
 *   FORTNOX_ACCESS_TOKEN     Bearer access token (obtained via OAuth2 flow)
 *
 * OAuth2 flow (authorization-code):
 *   1. Redirect to https://apps.fortnox.se/oauth-v1/auth?client_id=...&scope=...
 *   2. Exchange code at https://apps.fortnox.se/oauth-v1/token
 *   3. Store access_token and refresh_token
 *   4. Refresh using POST https://apps.fortnox.se/oauth-v1/token
 *      with grant_type=refresh_token
 */

const API_BASE = process.env.FORTNOX_API_URL ?? 'https://api.fortnox.se/3';

function headers(token: string) {
  return {
    Authorization:  `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FortnoxCustomer {
  CustomerNumber?: string;
  Name:            string;
  OrganisationNumber?: string;
  Address1?:       string;
  City?:           string;
  ZipCode?:        string;
  Country?:        string;
  Email?:          string;
  Phone1?:         string;
  Type?:           'PRIVATE' | 'COMPANY';
}

export interface FortnoxInvoiceRow {
  ArticleNumber?:   string;
  Description:      string;
  DeliveredQuantity: number;
  Price:            number;
  VAT?:             number;   // percent, e.g. 25
  Unit?:            string;
}

export interface FortnoxInvoice {
  CustomerNumber:  string;
  InvoiceDate?:    string;  // YYYY-MM-DD
  DueDate?:        string;  // YYYY-MM-DD
  YourReference?:  string;
  OurReference?:   string;
  Remarks?:        string;
  InvoiceRows:     FortnoxInvoiceRow[];
  Currency?:       string;  // default SEK
  Language?:       'SV' | 'EN';
}

export interface FortnoxInvoiceResponse {
  InvoiceNumber: string;
  CustomerName:  string;
  Total:         number;
  Balance:       number;
  DocumentNumber?: string;
  ExternalInvoiceReference1?: string;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export async function createCustomer(
  token:    string,
  customer: FortnoxCustomer,
): Promise<FortnoxCustomer> {
  const res = await fetch(`${API_BASE}/customers`, {
    method:  'POST',
    headers: headers(token),
    body:    JSON.stringify({ Customer: customer }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fortnox createCustomer ${res.status}: ${err}`);
  }
  const data = await res.json() as { Customer: FortnoxCustomer };
  return data.Customer;
}

export async function getCustomerByOrgNumber(
  token:     string,
  orgNumber: string,
): Promise<FortnoxCustomer | null> {
  const res = await fetch(
    `${API_BASE}/customers?organisationnumber=${encodeURIComponent(orgNumber)}`,
    { headers: headers(token) },
  );
  if (!res.ok) return null;
  const data = await res.json() as { Customers: FortnoxCustomer[] };
  return data.Customers?.[0] ?? null;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export async function createInvoice(
  token:   string,
  invoice: FortnoxInvoice,
): Promise<FortnoxInvoiceResponse> {
  const res = await fetch(`${API_BASE}/invoices`, {
    method:  'POST',
    headers: headers(token),
    body:    JSON.stringify({ Invoice: invoice }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fortnox createInvoice ${res.status}: ${err}`);
  }
  const data = await res.json() as { Invoice: FortnoxInvoiceResponse };
  return data.Invoice;
}

export async function getInvoice(
  token:         string,
  invoiceNumber: string,
): Promise<FortnoxInvoiceResponse | null> {
  const res = await fetch(`${API_BASE}/invoices/${encodeURIComponent(invoiceNumber)}`, {
    headers: headers(token),
  });
  if (!res.ok) return null;
  const data = await res.json() as { Invoice: FortnoxInvoiceResponse };
  return data.Invoice;
}

export async function bookkeepInvoice(
  token:         string,
  invoiceNumber: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/invoices/${encodeURIComponent(invoiceNumber)}/bookkeep`, {
    method:  'PUT',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fortnox bookkeepInvoice ${res.status}: ${err}`);
  }
}

// ─── Refresh token ────────────────────────────────────────────────────────────

export async function refreshAccessToken(
  clientId:     string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
  });
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://apps.fortnox.se/oauth-v1/token', {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${encoded}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fortnox token refresh ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Connection test ──────────────────────────────────────────────────────────

export async function testConnection(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/companyinformation`, {
      headers: headers(token),
    });
    return res.ok;
  } catch {
    return false;
  }
}
