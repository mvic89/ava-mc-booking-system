/**
 * lib/payments/types.ts
 *
 * Shared types for the payment provider registry.
 * These types describe *what a provider is*, not how to call its API.
 * The actual API calls stay in lib/svea/, lib/klarna/, etc.
 */

// ─── Categories ───────────────────────────────────────────────────────────────

/**
 * High-level category for grouping providers in the payment UI.
 */
export type PaymentCategory =
  | 'financing'       // Billån / Avbetalning: Svea, Santander, Resurs, Nordea Finans
  | 'bnpl'            // Köp nu betala senare: Klarna, Qliro, Walley
  | 'instant'         // Direktbetalning: Swish, Trustly, BankID Pay
  | 'card_terminal'   // Kortläsare (blipp): Nets AXEPT, Adyen Terminal, Stripe Terminal
  | 'card_online'     // Kort online: Stripe, Adyen, Bambora
  | 'bank_transfer';  // Banköverföring: Bankgiro, IBAN

// ─── Capabilities ─────────────────────────────────────────────────────────────

/**
 * What a provider can do. Used to filter providers by use case.
 */
export type PaymentCapability =
  | 'instore'         // usable at a physical dealership counter
  | 'online'          // usable on a web page / embedded widget
  | 'recurring'       // supports subscription / recurring charges
  | 'refund'          // supports full refunds
  | 'partial_refund'  // supports partial refunds
  | 'bankid'          // customer signs/authenticates with BankID
  | 'sms_flow'        // sends SMS link to customer's phone
  | 'contactless';    // NFC / tap-to-pay

// ─── Auth method ──────────────────────────────────────────────────────────────

export type AuthMethod =
  | 'basic'           // HTTP Basic Auth (username + password)
  | 'hmac'            // HMAC-SHA512 (Svea Checkout/Admin)
  | 'oauth2'          // OAuth2 client credentials
  | 'api_key'         // Static API key in header
  | 'none';           // No auth (e.g. open webhook)

// ─── Implementation status ────────────────────────────────────────────────────

export type ImplementationStatus =
  | 'live'            // Fully implemented and tested
  | 'partial'         // API client exists, some routes missing
  | 'stub'            // UI exists but API calls are mocked
  | 'planned';        // Listed in registry, not yet started

// ─── Core interface ───────────────────────────────────────────────────────────

export interface PaymentProviderDef {
  /** Unique slug used as the key everywhere (e.g. 'svea', 'klarna', 'swish') */
  id:           string;

  /** Human-readable display name */
  name:         string;

  /** Short description shown in the UI */
  description:  string;

  /** Emoji or icon identifier for quick visual identification */
  icon:         string;

  category:     PaymentCategory;
  capabilities: PaymentCapability[];

  /** ISO 3166-1 alpha-2 country codes where this provider operates */
  countries:    string[];

  /** ISO 4217 currency codes this provider accepts */
  currencies:   string[];

  authMethod:   AuthMethod;

  status:       ImplementationStatus;

  /**
   * Environment variables required for this provider.
   * Used to auto-detect if the provider is configured.
   * Vars ending in `_URL` are treated as non-sensitive base URLs in the UI.
   */
  requiredEnvVars: string[];

  /**
   * Default (test/sandbox) values for URL-type env vars.
   * Pre-filled in the Settings UI and written to .env.local when saving.
   * Only URL env vars should have defaults here — never credentials.
   */
  envVarDefaults?: Record<string, string>;

  /** Developer docs / sign-up URL */
  docsUrl?: string;

  /**
   * Next.js API route paths provided by this system.
   * Documents the internal endpoints so devs know what exists.
   */
  apiRoutes?: {
    method:      'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path:        string;
    description: string;
  }[];
}

// ─── Dealer configuration ─────────────────────────────────────────────────────

/**
 * Per-dealer payment configuration.
 * Start with a static config file; move to DB (dealer_payment_methods table) when ready.
 */
export interface DealerPaymentConfig {
  /** Dealer/company identifier */
  dealerId:           string;

  /** Human-readable dealer name */
  dealerName:         string;

  /** Which provider IDs are active for this dealer */
  enabledProviders:   string[];

  /**
   * Per-provider overrides (e.g. a dealer's own Svea merchant ID).
   * If omitted, the global env vars are used.
   */
  providerOverrides?: Record<string, Record<string, string>>;

  /** The preferred financing provider shown first */
  primaryFinancing?:  string;

  /** Whether to show the "coming soon" providers in the UI */
  showPlanned?:       boolean;
}
