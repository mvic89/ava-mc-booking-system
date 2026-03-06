/**
 * lib/payments/dealer-config.ts
 *
 * Per-dealer payment method configuration.
 *
 * Currently a static TypeScript file — replace the DEALER_CONFIGS lookup
 * with a database query when the DB layer is ready:
 *
 *   // TODO: replace with:
 *   // SELECT * FROM dealer_payment_configs WHERE dealer_id = ?
 *
 * Each entry controls:
 *   - Which payment providers are visible/active for this dealer
 *   - The preferred financing provider (shown first)
 *   - Optional per-provider credential overrides (for dealers with their own accounts)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ONBOARD A NEW DEALERSHIP
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Add an entry to DEALER_CONFIGS with the dealer's ID and name.
 * 2. Set enabledProviders to the list of provider IDs they want.
 *    → All IDs must exist in lib/payments/registry.ts.
 * 3. If the dealer has their own Svea/Klarna account, add providerOverrides.
 *    → Otherwise the global env vars (SVEA_CHECKOUT_MERCHANT_ID etc.) are used.
 * 4. Commit and deploy — the payment UI auto-renders the right tabs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { DealerPaymentConfig } from './types';

export const DEALER_CONFIGS: DealerPaymentConfig[] = [

  // ─── AVA MC (default / fallback dealer) ─────────────────────────────────
  {
    dealerId:         'ava-mc',
    dealerName:       'AVA MC AB',
    primaryFinancing: 'svea',
    enabledProviders: [
      'svea',           // Financing via SMS link + BankID
      'santander',      // Financing (secondary)
      'klarna',         // BNPL / Klarna widget
      'swish',          // Instant payment
      'nets',           // Blipp / card terminal
      'bank_transfer',  // Manual bank transfer
    ],
    showPlanned: false,
  },

  // ─── Example: a dealer that also uses Resurs Bank ────────────────────────
  // Uncomment and fill in when Resurs Bank is implemented.
  //
  // {
  //   dealerId:         'moto-sthlm',
  //   dealerName:       'Moto Stockholm AB',
  //   primaryFinancing: 'resurs',
  //   enabledProviders: [
  //     'resurs',
  //     'klarna',
  //     'swish',
  //     'nets',
  //     'bank_transfer',
  //   ],
  // },

  // ─── Example: a dealer that uses Stripe for online card payments ─────────
  //
  // {
  //   dealerId:         'nordic-bikes',
  //   dealerName:       'Nordic Bikes AB',
  //   primaryFinancing: 'santander',
  //   enabledProviders: [
  //     'santander',
  //     'klarna',
  //     'swish',
  //     'stripe',          // online card
  //     'nets',
  //     'bank_transfer',
  //   ],
  //   providerOverrides: {
  //     stripe: {
  //       STRIPE_SECRET_KEY:      'sk_live_nordic_bikes_key',
  //       STRIPE_PUBLISHABLE_KEY: 'pk_live_nordic_bikes_key',
  //     },
  //   },
  // },

];

// ─── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Get the payment config for a dealer.
 * Falls back to 'ava-mc' (the default config) if the dealer is not found.
 *
 * TODO: Replace with:
 *   SELECT * FROM dealer_payment_configs WHERE dealer_id = $dealerId
 */
export function getDealerConfig(dealerId: string): DealerPaymentConfig {
  return (
    DEALER_CONFIGS.find(c => c.dealerId === dealerId) ??
    DEALER_CONFIGS.find(c => c.dealerId === 'ava-mc')!
  );
}
