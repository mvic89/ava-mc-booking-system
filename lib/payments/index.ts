/**
 * lib/payments/index.ts
 *
 * Main entry point for the payment registry.
 * Import from here — not from the individual files.
 *
 *   import { getEnabledProviders, isProviderEnabled } from '@/lib/payments';
 */

export type {
  PaymentProviderDef,
  DealerPaymentConfig,
  PaymentCategory,
  PaymentCapability,
  AuthMethod,
  ImplementationStatus,
} from './types';

export {
  PAYMENT_REGISTRY,
  getProvider,
  getByCategory,
  getByCapability,
  getLiveProviders,
} from './registry';

export {
  DEALER_CONFIGS,
  getDealerConfig,
} from './dealer-config';

// ─── Composed helpers ─────────────────────────────────────────────────────────

import { PAYMENT_REGISTRY }  from './registry';
import { getDealerConfig }   from './dealer-config';
import type { PaymentProviderDef } from './types';

/**
 * Returns all enabled payment providers for a dealer, in the order
 * they appear in the dealer's enabledProviders list.
 *
 * Only returns providers that:
 *   - Are in the registry
 *   - Have status !== 'planned' (unless showPlanned is true for this dealer)
 *
 * Usage in a payment page:
 *   const providers = getEnabledProviders('ava-mc');
 *   // → [SveaDef, KlarnaDef, SwishDef, NetsDef, BankTransferDef]
 */
export function getEnabledProviders(dealerId: string): PaymentProviderDef[] {
  const config = getDealerConfig(dealerId);
  return config.enabledProviders
    .map(id => PAYMENT_REGISTRY.find(p => p.id === id))
    .filter((p): p is PaymentProviderDef => {
      if (!p) return false;
      if (p.status === 'planned' && !config.showPlanned) return false;
      return true;
    });
}

/**
 * Check whether a specific provider is enabled for a dealer.
 *
 * Usage:
 *   if (isProviderEnabled('moto-sthlm', 'klarna')) { ... }
 */
export function isProviderEnabled(dealerId: string, providerId: string): boolean {
  const config = getDealerConfig(dealerId);
  return config.enabledProviders.includes(providerId);
}

/**
 * Check whether all required env vars for a provider are set.
 * Useful for a health-check page or admin dashboard.
 *
 * Note: runs server-side only (accesses process.env).
 */
export function isProviderConfigured(providerId: string): boolean {
  const provider = PAYMENT_REGISTRY.find(p => p.id === providerId);
  if (!provider) return false;
  return provider.requiredEnvVars.every(v => !!process.env[v]);
}

/**
 * Returns a map of all providers and whether they are currently configured
 * (i.e. their env vars are set). For use in an admin dashboard.
 *
 * Example output:
 *   { svea: true, klarna: true, resurs: false, stripe: false, ... }
 */
export function getProviderConfigStatus(): Record<string, boolean> {
  return Object.fromEntries(
    PAYMENT_REGISTRY.map(p => [p.id, isProviderConfigured(p.id)])
  );
}
