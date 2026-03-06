/**
 * lib/payments/config-store.ts
 *
 * File-based payment configuration store. SERVER-SIDE ONLY.
 *
 * Stores per-dealer payment configs (enabled providers + credentials) in
 * data/payment-configs.json. This file is designed to be a direct swap for
 * a database table — replace the read/write functions with DB queries when ready.
 *
 * TODO (DB migration): Replace readStore()/writeStore() with:
 *   SELECT * FROM dealer_payment_configs WHERE dealer_id = $1
 *   INSERT INTO dealer_payment_configs ... ON CONFLICT DO UPDATE SET ...
 *
 * SECURITY: Credentials stored here are in plain text.
 * In production: encrypt with AES-256 before writing, decrypt on read.
 * Use process.env.CONFIG_ENCRYPTION_KEY for the encryption key.
 * Never commit data/payment-configs.json to git (add to .gitignore).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const DATA_DIR  = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'payment-configs.json');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredDealerConfig {
  dealerId:          string;
  dealerName:        string;
  enabledProviders:  string[];
  primaryFinancing:  string;
  /** Raw credential values per provider. { providerId: { ENV_VAR_NAME: value } } */
  credentials:       Record<string, Record<string, string>>;
  updatedAt:         string;
}

type ConfigStore = Record<string, StoredDealerConfig>;

// ─── Field status for the UI ──────────────────────────────────────────────────

/**
 * Whether a credential field is configured.
 * The UI shows these as coloured indicators — never the actual value.
 */
export type FieldStatus = 'configured' | 'env' | 'empty';

export interface ProviderConfigStatus {
  id:          string;
  fieldStatus: Record<string, FieldStatus>;
}

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

export function getStoredConfig(dealerId: string): StoredDealerConfig | null {
  return readStore()[dealerId] ?? null;
}

export function saveStoredConfig(config: StoredDealerConfig): void {
  const store = readStore();
  store[config.dealerId] = { ...config, updatedAt: new Date().toISOString() };
  writeStore(store);
}

/**
 * Get or create a dealer config.
 * Called when a new dealer signs up — sets up a blank config.
 */
export function initDealerConfig(
  dealerId:   string,
  dealerName: string,
): StoredDealerConfig {
  const existing = getStoredConfig(dealerId);
  if (existing) return existing;
  const fresh: StoredDealerConfig = {
    dealerId,
    dealerName,
    enabledProviders: [],
    primaryFinancing: '',
    credentials:      {},
    updatedAt:        new Date().toISOString(),
  };
  saveStoredConfig(fresh);
  return fresh;
}

/**
 * Get the stored credential value for a specific field.
 * Used by API routes to look up a dealer's credential instead of process.env.
 *
 * Falls back to process.env if not stored (lets existing env vars keep working).
 */
export function getCredential(
  dealerId:   string,
  providerId: string,
  envVarName: string,
): string {
  const config = getStoredConfig(dealerId);
  return (
    config?.credentials?.[providerId]?.[envVarName] ??
    process.env[envVarName] ??
    ''
  );
}

/**
 * Returns the status of each required env var for every provider
 * without exposing the actual values. Used by the settings UI.
 *
 * Priority: stored config > process.env > empty
 */
export function getProviderFieldStatuses(
  dealerId:        string,
  requiredEnvVars: string[],
  providerId:      string,
): Record<string, FieldStatus> {
  const config = getStoredConfig(dealerId);
  const stored = config?.credentials?.[providerId] ?? {};

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
