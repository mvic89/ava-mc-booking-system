/**
 * lib/integrations/config-store.ts
 *
 * Supabase-backed configuration store for non-payment integrations.
 * Credentials are stored in the `dealership_integrations` table so they
 * persist across server restarts, deployments, and logins.
 *
 * SERVER-SIDE ONLY.
 */

import { getSupabaseAdmin } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredIntegrationConfig {
  dealerId:             string;
  dealerName:           string;
  enabledIntegrations:  string[];
  /** Raw credential values per integration. { integrationId: { ENV_VAR_NAME: value } } */
  credentials:          Record<string, Record<string, string>>;
  updatedAt:            string;
}

export type FieldStatus = 'configured' | 'env' | 'empty';

// ─── Supabase helpers ─────────────────────────────────────────────────────────

interface DbRow {
  integration_id: string;
  dealer_name:    string | null;
  credentials:    Record<string, string>;
  enabled:        boolean;
  updated_at:     string;
}

// ─── Public API (all async) ───────────────────────────────────────────────────

export async function getStoredConfig(dealerId: string): Promise<StoredIntegrationConfig | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseAdmin() as any;
  const { data, error } = await sb
    .from('dealership_integrations')
    .select('integration_id, dealer_name, credentials, enabled, updated_at')
    .eq('dealership_id', dealerId);

  if (error || !data || data.length === 0) return null;

  const rows = data as DbRow[];
  const credentials: Record<string, Record<string, string>> = {};
  const enabledIntegrations: string[] = [];
  let dealerName = '';
  let updatedAt  = '';

  for (const row of rows) {
    credentials[row.integration_id] = row.credentials ?? {};
    if (row.enabled) enabledIntegrations.push(row.integration_id);
    if (row.dealer_name) dealerName = row.dealer_name;
    if (!updatedAt || row.updated_at > updatedAt) updatedAt = row.updated_at;
  }

  return { dealerId, dealerName, enabledIntegrations, credentials, updatedAt };
}

export async function saveStoredConfig(config: StoredIntegrationConfig): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb  = getSupabaseAdmin() as any;
  const now = new Date().toISOString();

  // Collect all integration IDs that have credentials or an enabled state
  const allIds = new Set([
    ...config.enabledIntegrations,
    ...Object.keys(config.credentials),
  ]);

  for (const integrationId of allIds) {
    const { error } = await sb.from('dealership_integrations').upsert({
      dealership_id:  config.dealerId,
      integration_id: integrationId,
      dealer_name:    config.dealerName || null,
      credentials:    config.credentials[integrationId] ?? {},
      enabled:        config.enabledIntegrations.includes(integrationId),
      updated_at:     now,
    }, { onConflict: 'dealership_id,integration_id' });

    if (error) {
      console.error(`[config-store] upsert failed for ${integrationId}:`, error.message);
    }
  }
}

export async function initDealerConfig(
  dealerId:   string,
  dealerName: string,
): Promise<StoredIntegrationConfig> {
  const existing = await getStoredConfig(dealerId);
  if (existing) return existing;
  return {
    dealerId,
    dealerName,
    enabledIntegrations: [],
    credentials:         {},
    updatedAt:           new Date().toISOString(),
  };
}

/**
 * Get a single credential value.
 * Priority: Supabase DB → process.env → ''
 */
export async function getCredential(
  dealerId:       string,
  integrationId:  string,
  envVarName:     string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseAdmin() as any;
  const { data } = await sb
    .from('dealership_integrations')
    .select('credentials')
    .eq('dealership_id', dealerId)
    .eq('integration_id', integrationId)
    .maybeSingle();

  const stored = (data?.credentials as Record<string, string> | null)?.[envVarName]?.trim();
  if (stored) return stored;
  return process.env[envVarName] ?? '';
}

/**
 * Returns UI-safe status for each required env var (never the actual value).
 */
export async function getIntegrationFieldStatuses(
  dealerId:        string,
  requiredEnvVars: string[],
  integrationId:   string,
): Promise<Record<string, FieldStatus>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseAdmin() as any;
  const { data } = await sb
    .from('dealership_integrations')
    .select('credentials')
    .eq('dealership_id', dealerId)
    .eq('integration_id', integrationId)
    .maybeSingle();

  const stored = (data?.credentials as Record<string, string> | null) ?? {};
  const result: Record<string, FieldStatus> = {};

  for (const v of requiredEnvVars) {
    if (stored[v]?.trim()) {
      result[v] = 'configured';
    } else if (process.env[v]?.trim()) {
      result[v] = 'env';
    } else {
      result[v] = 'empty';
    }
  }
  return result;
}

/**
 * Returns ALL saved credential values for pre-filling the settings UI.
 * Secret fields are returned as-is — the UI masks them with type="password".
 */
export async function getCredentialDisplayValues(
  dealerId:        string,
  integrationId:   string,
  requiredEnvVars: string[],
): Promise<Record<string, string>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseAdmin() as any;
  const { data } = await sb
    .from('dealership_integrations')
    .select('credentials')
    .eq('dealership_id', dealerId)
    .eq('integration_id', integrationId)
    .maybeSingle();

  const stored = (data?.credentials as Record<string, string> | null) ?? {};
  const result: Record<string, string> = {};

  for (const v of requiredEnvVars) {
    result[v] = stored[v]?.trim() ?? process.env[v]?.trim() ?? '';
  }
  return result;
}
