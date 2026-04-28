/**
 * lib/fortnox/sync.ts
 *
 * Core Fortnox sync logic — runs server-side only (API routes / auto-trigger).
 * Syncs paid invoices from this system into Fortnox as official invoices.
 *
 * Usage:
 *   import { syncInvoicesToFortnox } from '@/lib/fortnox/sync';
 *   await syncInvoicesToFortnox(dealershipId);                  // all pending
 *   await syncInvoicesToFortnox(dealershipId, ['INV-2025-001']); // specific IDs
 */

import {
  createCustomer,
  createInvoice,
  getCustomerByOrgNumber,
  refreshAccessToken,
} from '@/lib/fortnox/client';
import {
  getCredential,
  getStoredConfig,
  saveStoredConfig,
} from '@/lib/integrations/config-store';
import { getSupabaseAdmin } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

// ── Token management ──────────────────────────────────────────────────────────

/**
 * Returns a valid access token for the given dealership.
 * Automatically refreshes if the stored token is expired.
 */
async function getValidToken(dealershipId: string): Promise<string> {
  let token = await getCredential(dealershipId, 'fortnox', 'FORTNOX_ACCESS_TOKEN');

  const expiresAtStr = await getCredential(dealershipId, 'fortnox', 'FORTNOX_TOKEN_EXPIRES_AT');
  const expiresAt    = expiresAtStr ? Number(expiresAtStr) : 0;
  const isExpired    = expiresAt > 0 && Date.now() > expiresAt - 60_000; // 1-min buffer

  if (isExpired) {
    const refreshToken  = await getCredential(dealershipId, 'fortnox', 'FORTNOX_REFRESH_TOKEN');
    const clientId      = await getCredential(dealershipId, 'fortnox', 'FORTNOX_CLIENT_ID');
    const clientSecret  = await getCredential(dealershipId, 'fortnox', 'FORTNOX_CLIENT_SECRET');

    if (refreshToken && clientId && clientSecret) {
      try {
        const result = await refreshAccessToken(clientId, clientSecret, refreshToken);
        // Persist refreshed tokens back to config store
        const cfg = await getStoredConfig(dealershipId);
        if (cfg) {
          cfg.credentials.fortnox = {
            ...cfg.credentials.fortnox,
            FORTNOX_ACCESS_TOKEN:     result.access_token,
            FORTNOX_REFRESH_TOKEN:    result.refresh_token,
            FORTNOX_TOKEN_EXPIRES_AT: String(Date.now() + result.expires_in * 1_000),
          };
          await saveStoredConfig(cfg);
          token = result.access_token;
        }
      } catch (e) {
        console.error('[fortnox/sync] token refresh failed:', e);
        // Fall through with existing (possibly expired) token
      }
    }
  }

  return token;
}

// ── Customer helper ───────────────────────────────────────────────────────────

/**
 * Ensures the customer exists in Fortnox and returns their CustomerNumber.
 * Priority: 1) stored fortnox_customer_number, 2) lookup by personnummer, 3) create.
 */
async function ensureFortnoxCustomer(
  token:       string,
  customerId:  number | null,
  dealershipId: string,
  fallbackName: string,
): Promise<string | null> {
  if (!customerId) {
    // No customer linked — create a minimal unnamed customer
    try {
      const cust = await createCustomer(token, { Name: fallbackName, Type: 'PRIVATE' });
      return cust.CustomerNumber ?? null;
    } catch {
      return null;
    }
  }

  // Fetch customer row from our DB
  const { data: cust } = await sb()
    .from('customers')
    .select('first_name, last_name, personnummer, email, phone, address, postal_code, city, fortnox_customer_number')
    .eq('id', customerId)
    .eq('dealership_id', dealershipId)
    .maybeSingle();

  if (!cust) return null;

  // Already synced previously — use stored number
  if (cust.fortnox_customer_number) return cust.fortnox_customer_number as string;

  const fullName = `${cust.first_name ?? ''} ${cust.last_name ?? ''}`.trim() || fallbackName;

  // Look up by personnummer in Fortnox
  if (cust.personnummer) {
    try {
      const existing = await getCustomerByOrgNumber(token, cust.personnummer as string);
      if (existing?.CustomerNumber) {
        // Cache the number back to our DB
        await sb()
          .from('customers')
          .update({ fortnox_customer_number: existing.CustomerNumber })
          .eq('id', customerId)
          .eq('dealership_id', dealershipId);
        return existing.CustomerNumber;
      }
    } catch { /* ignore — fall through to create */ }
  }

  // Create new customer in Fortnox
  try {
    const created = await createCustomer(token, {
      Name:               fullName,
      OrganisationNumber: cust.personnummer || undefined,
      Address1:           cust.address      || undefined,
      City:               cust.city         || undefined,
      ZipCode:            cust.postal_code  || undefined,
      Country:            'Sverige',
      Email:              cust.email        || undefined,
      Phone1:             cust.phone        || undefined,
      Type:               'PRIVATE',
    });

    if (created.CustomerNumber) {
      await sb()
        .from('customers')
        .update({ fortnox_customer_number: created.CustomerNumber })
        .eq('id', customerId)
        .eq('dealership_id', dealershipId);
    }
    return created.CustomerNumber ?? null;
  } catch (e) {
    console.error('[fortnox/sync] createCustomer failed:', e);
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

/**
 * Syncs paid invoices to Fortnox.
 *
 * @param dealershipId  UUID of the dealer whose invoices to sync
 * @param invoiceIds    Optional list of specific invoice IDs (INV-YYYY-NNN).
 *                      If omitted, all paid + unsynced invoices are processed.
 */
export async function syncInvoicesToFortnox(
  dealershipId: string,
  invoiceIds?:  string[],
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, errors: [] };

  const token = await getValidToken(dealershipId);
  if (!token) {
    result.errors.push('Fortnox access token is not configured for this dealership.');
    result.failed = 1;
    return result;
  }

  // Build query: paid invoices not yet synced to Fortnox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb()
    .from('invoices')
    .select('id, customer_id, customer_name, vehicle, net_amount, vat_amount, total_amount, agreement_ref, issue_date')
    .eq('dealership_id', dealershipId)
    .eq('status', 'paid')
    .is('fortnox_invoice_number', null);

  if (invoiceIds && invoiceIds.length > 0) {
    q = q.in('id', invoiceIds);
  }

  const { data: invoices, error: fetchErr } = await q;

  if (fetchErr) {
    result.errors.push(`Failed to fetch invoices: ${fetchErr.message}`);
    result.failed = 1;
    return result;
  }

  if (!invoices || invoices.length === 0) {
    return result; // nothing to do
  }

  // Process each invoice
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const inv of invoices as any[]) {
    try {
      // Step 1: Ensure customer exists in Fortnox
      const customerNumber = await ensureFortnoxCustomer(
        token,
        inv.customer_id ?? null,
        dealershipId,
        inv.customer_name ?? 'Okänd kund',
      );

      if (!customerNumber) {
        throw new Error(`Could not resolve Fortnox customer for invoice ${inv.id}`);
      }

      // Step 2: Create invoice in Fortnox
      const today   = new Date(inv.issue_date ?? new Date());
      const dueDate = new Date(today.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

      const fortnoxInvoice = await createInvoice(token, {
        CustomerNumber: customerNumber,
        InvoiceDate:    today.toISOString().slice(0, 10),
        DueDate:        dueDate,
        YourReference:  inv.agreement_ref || inv.id,
        Remarks:        inv.agreement_ref ? `Köpeavtal ${inv.agreement_ref}` : inv.id,
        Currency:       'SEK',
        Language:       'SV',
        InvoiceRows: [
          {
            Description:       String(inv.vehicle ?? 'Motorcykel'),
            DeliveredQuantity: 1,
            Price:             Number(inv.net_amount ?? 0),
            VAT:               25,
          },
        ],
      });

      // Step 3: Update our DB row with Fortnox invoice number
      await sb()
        .from('invoices')
        .update({
          fortnox_invoice_number: fortnoxInvoice.InvoiceNumber,
          fortnox_synced_at:      new Date().toISOString(),
          fortnox_sync_error:     null,
        })
        .eq('id', inv.id)
        .eq('dealership_id', dealershipId);

      result.synced++;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[fortnox/sync] invoice ${inv.id} failed:`, msg);
      result.failed++;
      result.errors.push(`${inv.id}: ${msg}`);

      // Record the error against the invoice row so the UI can surface it
      await sb()
        .from('invoices')
        .update({ fortnox_sync_error: msg })
        .eq('id', inv.id)
        .eq('dealership_id', dealershipId);
    }
  }

  return result;
}
