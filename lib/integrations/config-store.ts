/**
 * lib/integrations/config-store.ts
 *
 * File-based configuration store for non-payment integrations.
 * SERVER-SIDE ONLY. Stores per-dealer integration credentials in
 * data/integration-configs.json.
 *
 * Mirror of lib/payments/config-store.ts — same pattern, separate file.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const DATA_DIR  = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'integration-configs.json');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredIntegrationConfig {
  dealerId:             string;
  dealerName:           string;
  enabledIntegrations:  string[];
  /** Raw credential values per integration. { integrationId: { ENV_VAR_NAME: value } } */
  credentials:          Record<string, Record<string, string>>;
  updatedAt:            string;
}

type ConfigStore = Record<string, StoredIntegrationConfig>;

export type FieldStatus = 'configured' | 'env' | 'empty';

// ─── File I/O ─────────────────────────────────────────────────────────────────

function readStore(): ConfigStore {
  if (!existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as ConfigStore;
  } catch {
    return {};
  }
}

function writeStore(store: ConfigStore): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getStoredConfig(dealerId: string): StoredIntegrationConfig | null {
  return readStore()[dealerId] ?? null;
}

export function saveStoredConfig(config: StoredIntegrationConfig): void {
  const store = readStore();
  store[config.dealerId] = { ...config, updatedAt: new Date().toISOString() };
  writeStore(store);
}

export function initDealerConfig(
  dealerId:   string,
  dealerName: string,
): StoredIntegrationConfig {
  const existing = getStoredConfig(dealerId);
  if (existing) return existing;
  const fresh: StoredIntegrationConfig = {
    dealerId,
    dealerName,
    enabledIntegrations: [],
    credentials:         {},
    updatedAt:           new Date().toISOString(),
  };
  saveStoredConfig(fresh);
  return fresh;
}

/**
 * Get a credential value. Falls back to process.env then empty string.
 */
export function getCredential(
  dealerId:       string,
  integrationId:  string,
  envVarName:     string,
): string {
  const config = getStoredConfig(dealerId);
  return (
    config?.credentials?.[integrationId]?.[envVarName] ??
    process.env[envVarName] ??
    ''
  );
}

/**
 * Returns UI-safe status for each required env var (never the actual value).
 */
export function getIntegrationFieldStatuses(
  dealerId:        string,
  requiredEnvVars: string[],
  integrationId:   string,
): Record<string, FieldStatus> {
  const config = getStoredConfig(dealerId);
  const stored = config?.credentials?.[integrationId] ?? {};

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
