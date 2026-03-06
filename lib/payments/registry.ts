/**
 * lib/payments/registry.ts
 *
 * Central registry of every payment provider available in Sweden for
 * motorcycle dealerships. This is the single source of truth.
 *
 * To add a new provider:
 *   1. Add an entry here with the correct metadata.
 *   2. Create lib/{provider}/client.ts with the API calls.
 *   3. Create app/api/{provider}/ route files.
 *   4. Add env vars to .env.example.
 *
 * Status guide:
 *   live     → implemented and tested with real credentials
 *   partial  → API client exists but some routes/features missing
 *   stub     → UI tab exists but API calls are mocked
 *   planned  → documented here, not yet built
 */

import type { PaymentProviderDef } from './types';

export const PAYMENT_REGISTRY: PaymentProviderDef[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCING (Billån / Avbetalning)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:           'svea',
    name:         'Svea Ekonomi',
    description:  'Finansiering via SMS-länk. Kunden väljer plan och signerar med BankID på sin telefon.',
    icon:         '🏦',
    category:     'financing',
    capabilities: ['instore', 'sms_flow', 'bankid', 'refund', 'partial_refund'],
    countries:    ['SE', 'NO', 'FI', 'DK'],
    currencies:   ['SEK', 'NOK', 'EUR', 'DKK'],
    authMethod:   'basic',
    status:       'live',
    requiredEnvVars: [
      'SVEA_INSTORE_API_URL',
      'SVEA_EXTERNAL_API_URL',
      'SVEA_INSTORE_USERNAME',
      'SVEA_INSTORE_PASSWORD',
      'SVEA_CHECKOUT_MERCHANT_ID',
      'SVEA_CHECKOUT_SECRET',
    ],
    envVarDefaults: {
      SVEA_INSTORE_API_URL:  'https://webpayinstoreapistage.svea.com',
      SVEA_EXTERNAL_API_URL: 'https://paymentadminapistage.svea.com',
    },
    docsUrl: 'https://docs.payments.svea.com/docs/',
    apiRoutes: [
      { method: 'POST',  path: '/api/svea/order',                                           description: 'Create instore order → SMS to customer' },
      { method: 'GET',   path: '/api/svea/order/[orderId]',                                 description: 'Poll instore order status' },
      { method: 'POST',  path: '/api/svea/order/[orderId]/cancel',                          description: 'Cancel active instore order' },
      { method: 'POST',  path: '/api/svea/order/[orderId]/return',                          description: 'Return/refund completed order' },
      { method: 'POST',  path: '/api/svea/order/[orderId]/deliver',                         description: 'Deliver order (release funds)' },
      { method: 'POST',  path: '/api/svea/order/[orderId]/deliver-lower',                   description: 'Deliver at lower amount' },
      { method: 'POST',  path: '/api/svea/order/[orderId]/rows',                            description: 'Add order row(s)' },
      { method: 'PATCH', path: '/api/svea/order/[orderId]/rows/[rowId]',                    description: 'Update or cancel a single row' },
      { method: 'PATCH', path: '/api/svea/order/[orderId]/rows/cancel',                     description: 'Cancel multiple rows' },
      { method: 'POST',  path: '/api/svea/order/[orderId]/rows/update',                     description: 'Update multiple rows' },
      { method: 'PUT',   path: '/api/svea/order/[orderId]/rows/replace',                    description: 'Replace all rows' },
      { method: 'PATCH', path: '/api/svea/order/[orderId]/extend',                          description: 'Extend order expiry date' },
      { method: 'POST',  path: '/api/svea/order/[orderId]/deliveries/[deliveryId]/credits', description: 'Credit rows or amount after delivery' },
      { method: 'GET',   path: '/api/svea/reports',                                         description: 'Payout/reconciliation report' },
      { method: 'POST',  path: '/api/svea/checkout',                                        description: 'Create embedded Checkout order' },
      { method: 'GET',   path: '/api/svea/checkout',                                        description: 'Get available part-payment campaigns' },
      { method: 'GET',   path: '/api/svea/checkout/[orderId]',                              description: 'Get Checkout order' },
      { method: 'PUT',   path: '/api/svea/checkout/[orderId]',                              description: 'Update Checkout order cart' },
      { method: 'POST',  path: '/api/svea/callback',                                        description: 'Webhook: receive Svea order events' },
    ],
  },

  {
    id:           'santander',
    name:         'Santander Consumer Bank',
    description:  'Konsumentfinansiering för fordonsinköp. Populär bland svenska bilhandlare.',
    icon:         '🔴',
    category:     'financing',
    capabilities: ['instore', 'bankid', 'refund'],
    countries:    ['SE', 'NO', 'DK', 'FI', 'DE'],
    currencies:   ['SEK', 'NOK', 'DKK', 'EUR'],
    authMethod:   'api_key',
    status:       'live',
    requiredEnvVars: [
      'SANTANDER_API_URL',
      'SANTANDER_API_KEY',
      'SANTANDER_PARTNER_ID',
    ],
    envVarDefaults: {
      SANTANDER_API_URL: 'https://api.sandbox.santanderconsumer.se',
    },
    docsUrl: 'https://developer.santanderconsumer.se/',
    apiRoutes: [
      { method: 'POST', path: '/api/santander/application',                        description: 'Create financing application → BankID signing link' },
      { method: 'GET',  path: '/api/santander/application/[applicationId]',        description: 'Get application status' },
      { method: 'POST', path: '/api/santander/application/[applicationId]/cancel', description: 'Cancel pending application' },
      { method: 'POST', path: '/api/santander/application/[applicationId]/refund', description: 'Refund completed application' },
    ],
  },

  {
    id:           'resurs',
    name:         'Resurs Bank',
    description:  'Bred finansieringslösning med delbetalning, kontokort och faktura. Stor inom fordonshandel.',
    icon:         '💙',
    category:     'financing',
    capabilities: ['instore', 'online', 'bankid', 'refund', 'partial_refund', 'recurring'],
    countries:    ['SE', 'NO', 'DK', 'FI'],
    currencies:   ['SEK', 'NOK', 'DKK', 'EUR'],
    authMethod:   'oauth2',
    status:       'live',
    requiredEnvVars: [
      'RESURS_API_URL',
      'RESURS_CLIENT_ID',
      'RESURS_CLIENT_SECRET',
    ],
    envVarDefaults: {
      RESURS_API_URL: 'https://merchant-api.integration.resurs.com',
    },
    docsUrl: 'https://merchant-api.integration.resurs.com/',
    apiRoutes: [
      { method: 'GET',  path: '/api/resurs/methods',                       description: 'List available payment methods' },
      { method: 'POST', path: '/api/resurs/payment',                       description: 'Create payment → signingUrl for BankID' },
      { method: 'GET',  path: '/api/resurs/payment/[paymentId]',           description: 'Get payment status' },
      { method: 'POST', path: '/api/resurs/payment/[paymentId]/finalize',  description: 'Capture payment after delivery' },
      { method: 'POST', path: '/api/resurs/payment/[paymentId]/cancel',    description: 'Cancel payment before finalization' },
      { method: 'POST', path: '/api/resurs/payment/[paymentId]/credit',    description: 'Refund finalized payment' },
    ],
  },

  {
    id:           'nordea_finans',
    name:         'Nordea Finans',
    description:  'Fordonslån och finansiering via Nordea. Kräver partneravtal med Nordea.',
    icon:         '🌀',
    category:     'financing',
    capabilities: ['instore', 'bankid', 'refund'],
    countries:    ['SE', 'NO', 'FI', 'DK'],
    currencies:   ['SEK', 'NOK', 'EUR', 'DKK'],
    authMethod:   'oauth2',
    status:       'live',
    requiredEnvVars: [
      'NORDEA_API_URL',
      'NORDEA_CLIENT_ID',
      'NORDEA_CLIENT_SECRET',
    ],
    envVarDefaults: {
      NORDEA_API_URL: 'https://api.nordeaopenbanking.com',
    },
    docsUrl: 'https://developer.nordeaopenbanking.com/',
    apiRoutes: [
      { method: 'GET',  path: '/api/nordea-finans/auth/url',              description: 'Get OAuth2 URL → redirect user to Nordea login' },
      { method: 'POST', path: '/api/nordea-finans/auth/token',            description: 'Exchange auth code for access token' },
      { method: 'POST', path: '/api/nordea-finans/payment',               description: 'Initiate payment from customer account' },
      { method: 'GET',  path: '/api/nordea-finans/payment/[paymentId]',   description: 'Get payment status' },
    ],
  },

  {
    id:           'ikano',
    name:         'Ikano Bank',
    description:  'Konsumentkredit och delbetalning. Aktiv inom svensk fordonshandel.',
    icon:         '🟡',
    category:     'financing',
    capabilities: ['instore', 'online', 'bankid', 'refund'],
    countries:    ['SE', 'NO', 'DK', 'FI'],
    currencies:   ['SEK', 'NOK', 'DKK', 'EUR'],
    authMethod:   'api_key',
    status:       'live',
    requiredEnvVars: [
      'IKANO_API_URL',
      'IKANO_API_KEY',
      'IKANO_STORE_ID',
    ],
    envVarDefaults: {
      IKANO_API_URL: 'https://api.test.ikano.io',
    },
    docsUrl: 'https://www.ikanobank.se/foretag/',
    apiRoutes: [
      { method: 'GET',  path: '/api/ikano/campaigns',                            description: 'List available installment campaigns' },
      { method: 'POST', path: '/api/ikano/application',                          description: 'Create credit application → BankID signing link' },
      { method: 'GET',  path: '/api/ikano/application/[applicationId]',          description: 'Get application status' },
      { method: 'POST', path: '/api/ikano/application/[applicationId]/cancel',   description: 'Cancel application before signing' },
      { method: 'POST', path: '/api/ikano/application/[applicationId]/activate', description: 'Activate credit after vehicle delivery' },
      { method: 'POST', path: '/api/ikano/application/[applicationId]/refund',   description: 'Refund finalized credit' },
    ],
  },

  {
    id:           'walley',
    name:         'Walley (f.d. Collector)',
    description:  'Checkout, faktura och delbetalning. Hette Collector Bank, nu Walley.',
    icon:         '🟢',
    category:     'financing',
    capabilities: ['instore', 'online', 'refund', 'partial_refund'],
    countries:    ['SE', 'NO', 'FI'],
    currencies:   ['SEK', 'NOK', 'EUR'],
    authMethod:   'oauth2',
    status:       'live',
    requiredEnvVars: [
      'WALLEY_API_URL',
      'WALLEY_STORE_ID',
      'WALLEY_SHARED_KEY',
    ],
    envVarDefaults: {
      WALLEY_API_URL: 'https://seller-online.stage.walleypay.com',
    },
    docsUrl: 'https://dev.walleypay.com/docs/checkout/',
    apiRoutes: [
      { method: 'POST', path: '/api/walley/checkout',                 description: 'Create checkout session → publicToken for JS SDK' },
      { method: 'GET',  path: '/api/walley/checkout/[token]',         description: 'Get checkout status' },
      { method: 'PUT',  path: '/api/walley/checkout/[token]',         description: 'Update cart items in checkout' },
      { method: 'GET',  path: '/api/walley/order/[orderId]',          description: 'Get completed order' },
      { method: 'POST', path: '/api/walley/order/[orderId]/activate', description: 'Capture order' },
      { method: 'POST', path: '/api/walley/order/[orderId]/cancel',   description: 'Cancel order before capture' },
      { method: 'POST', path: '/api/walley/order/[orderId]/credit',   description: 'Refund captured order' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BNPL (Köp nu, betala senare)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:           'klarna',
    name:         'Klarna',
    description:  'Betala nu, om 30 dagar eller i månadsvis med Klarnas inbyggda widget.',
    icon:         '🛍',
    category:     'bnpl',
    capabilities: ['instore', 'online', 'refund', 'partial_refund', 'recurring'],
    countries:    ['SE', 'NO', 'FI', 'DK', 'DE', 'GB', 'US'],
    currencies:   ['SEK', 'NOK', 'EUR', 'DKK', 'GBP', 'USD'],
    authMethod:   'basic',
    status:       'live',
    requiredEnvVars: [
      'KLARNA_API_URL',
      'KLARNA_API_USERNAME',
      'KLARNA_API_PASSWORD',
    ],
    envVarDefaults: {
      KLARNA_API_URL: 'https://api.playground.klarna.com',
    },
    docsUrl: 'https://docs.klarna.com/',
    apiRoutes: [
      { method: 'POST', path: '/api/klarna/session', description: 'Create Klarna payment session → client_token' },
      { method: 'POST', path: '/api/klarna/order',   description: 'Place order after authorization_token received' },
    ],
  },

  {
    id:           'qliro',
    name:         'Qliro',
    description:  'Nordisk BNPL-lösning med inbyggd checkout. Populär i Sverige och Norge.',
    icon:         '🔷',
    category:     'bnpl',
    capabilities: ['online', 'refund', 'partial_refund'],
    countries:    ['SE', 'NO', 'DK', 'FI'],
    currencies:   ['SEK', 'NOK', 'DKK', 'EUR'],
    authMethod:   'api_key',
    status:       'live',
    requiredEnvVars: [
      'QLIRO_API_URL',
      'QLIRO_API_KEY',
      'QLIRO_MERCHANT_ID',
    ],
    envVarDefaults: {
      QLIRO_API_URL: 'https://api.sandbox.qliro.com',
    },
    docsUrl: 'https://developers.qliro.com/',
    apiRoutes: [
      { method: 'POST', path: '/api/qliro/checkout',                    description: 'Create Qliro checkout → iframe URL' },
      { method: 'GET',  path: '/api/qliro/order/[orderId]',             description: 'Get order status' },
      { method: 'POST', path: '/api/qliro/order/[orderId]/capture',     description: 'Capture payment after delivery' },
      { method: 'POST', path: '/api/qliro/order/[orderId]/cancel',      description: 'Cancel order before capture' },
      { method: 'POST', path: '/api/qliro/order/[orderId]/refund',      description: 'Refund captured order' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTANT / DIREKTBETALNING
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:           'swish',
    name:         'Swish',
    description:  'Direktbetalning via Swish-appen. Kräver att kunden har ett svenskt bankgiro-konto.',
    icon:         '📱',
    category:     'instant',
    capabilities: ['instore', 'online', 'refund'],
    countries:    ['SE'],
    currencies:   ['SEK'],
    authMethod:   'basic',
    status:       'live',
    requiredEnvVars: [
      'SWISH_API_URL',
      'SWISH_PAYEE_ALIAS',
      'SWISH_CERT_PATH',
      'SWISH_CERT_PASSPHRASE',
    ],
    envVarDefaults: {
      SWISH_API_URL: 'https://mss.cpc.getswish.net/swish-cpcapi/api/v2',
    },
    docsUrl: 'https://developer.swish.nu/',
    apiRoutes: [
      { method: 'POST',   path: '/api/swish/payment',          description: 'Create Swish payment request → poll for PAID status' },
      { method: 'GET',    path: '/api/swish/payment/[id]',     description: 'Get payment request status' },
      { method: 'DELETE', path: '/api/swish/payment/[id]',     description: 'Cancel payment request' },
      { method: 'POST',   path: '/api/swish/refund',           description: 'Create refund for completed payment' },
      { method: 'GET',    path: '/api/swish/refund/[id]',      description: 'Get refund status' },
      { method: 'POST',   path: '/api/swish/callback',         description: 'Webhook: receive Swish payment/refund events' },
    ],
  },

  {
    id:           'trustly',
    name:         'Trustly',
    description:  'Open banking-betalning direkt från kundens bank. Ingen kortdata lagras.',
    icon:         '🔐',
    category:     'instant',
    capabilities: ['online', 'refund'],
    countries:    ['SE', 'NO', 'FI', 'DK', 'DE', 'GB'],
    currencies:   ['SEK', 'NOK', 'EUR', 'DKK', 'GBP'],
    authMethod:   'oauth2',
    status:       'live',
    requiredEnvVars: [
      'TRUSTLY_API_URL',
      'TRUSTLY_API_KEY',
      'TRUSTLY_MERCHANT_ID',
      'TRUSTLY_PRIVATE_KEY',
    ],
    envVarDefaults: {
      TRUSTLY_API_URL: 'https://test.trustly.com/api/1',
    },
    docsUrl: 'https://eu.developers.trustly.com/',
    apiRoutes: [
      { method: 'POST', path: '/api/trustly/deposit',   description: 'Initiate deposit → redirect URL to bank selection' },
      { method: 'POST', path: '/api/trustly/refund',    description: 'Refund a completed deposit' },
      { method: 'POST', path: '/api/trustly/callback',  description: 'Webhook: receive Trustly notifications' },
    ],
  },

  {
    id:           'bankid_pay',
    name:         'BankID Pay',
    description:  'Betala med BankID — autentisering och betalning i ett steg via Bankgirot.',
    icon:         '🏧',
    category:     'instant',
    capabilities: ['instore', 'online', 'bankid', 'refund'],
    countries:    ['SE'],
    currencies:   ['SEK'],
    authMethod:   'oauth2',
    status:       'live',
    requiredEnvVars: [
      'BANKID_PAY_API_URL',
      'BANKID_PAY_CLIENT_ID',
      'BANKID_PAY_CLIENT_SECRET',
      'BANKID_CERT_PATH',
      'BANKID_CERT_PASSPHRASE',
    ],
    envVarDefaults: {
      BANKID_PAY_API_URL: 'https://appapi2.test.bankid.com/rp/v6.0',
    },
    docsUrl: 'https://developers.bankid.com/',
    apiRoutes: [
      { method: 'POST', path: '/api/bankid-pay/auth',    description: 'Initiate BankID authentication' },
      { method: 'POST', path: '/api/bankid-pay/sign',    description: 'Initiate BankID signing (shows payment details in app)' },
      { method: 'POST', path: '/api/bankid-pay/collect', description: 'Poll auth/sign order status' },
      { method: 'POST', path: '/api/bankid-pay/cancel',  description: 'Cancel ongoing auth/sign' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD TERMINAL (Kortläsare / Blipp)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:           'nets',
    name:         'Nets AXEPT',
    description:  'Fysisk kortläsare för blipp (NFC), chip+PIN och magnetremsa. Vanligast i Sverige.',
    icon:         '📡',
    category:     'card_terminal',
    capabilities: ['instore', 'contactless', 'refund', 'partial_refund'],
    countries:    ['SE', 'NO', 'DK', 'FI'],
    currencies:   ['SEK', 'NOK', 'DKK', 'EUR'],
    authMethod:   'api_key',
    status:       'live',
    requiredEnvVars: [
      'NETS_API_URL',
      'NETS_SECRET_KEY',
      'NETS_CHECKOUT_KEY',
      'NETS_MERCHANT_ID',
    ],
    envVarDefaults: {
      NETS_API_URL: 'https://test.api.dibspayment.eu',
    },
    docsUrl: 'https://developers.nets.eu/nets-easy/',
    apiRoutes: [
      { method: 'POST', path: '/api/nets/payment',                         description: 'Create Nets Easy payment session' },
      { method: 'GET',  path: '/api/nets/payment/[paymentId]',             description: 'Get payment status' },
      { method: 'POST', path: '/api/nets/payment/[paymentId]/charge',      description: 'Capture authorized payment' },
      { method: 'POST', path: '/api/nets/payment/[paymentId]/cancel',      description: 'Cancel authorized payment' },
      { method: 'POST', path: '/api/nets/charge/[chargeId]/refund',        description: 'Refund captured payment' },
      { method: 'POST', path: '/api/nets/terminal/payment',                description: 'Initiate AXEPT terminal payment (blipp/chip/pin)' },
      { method: 'GET',  path: '/api/nets/terminal/payment/[id]',           description: 'Get terminal payment status' },
    ],
  },

  {
    id:           'adyen_terminal',
    name:         'Adyen Terminal',
    description:  'Enterprise-kortterminaler (Android/Linux). Passar kedjor med många lokaler.',
    icon:         '🟩',
    category:     'card_terminal',
    capabilities: ['instore', 'contactless', 'refund', 'partial_refund', 'recurring'],
    countries:    ['SE', 'NO', 'DK', 'FI', 'DE', 'GB', 'US'],
    currencies:   ['SEK', 'NOK', 'EUR', 'DKK', 'GBP', 'USD'],
    authMethod:   'api_key',
    status:       'live',
    requiredEnvVars: [
      'ADYEN_TERMINAL_API_URL',
      'ADYEN_API_KEY',
      'ADYEN_MERCHANT_ACCOUNT',
      'ADYEN_TERMINAL_ID',
    ],
    envVarDefaults: {
      ADYEN_TERMINAL_API_URL: 'https://terminal-api-test.adyen.com',
    },
    docsUrl: 'https://docs.adyen.com/point-of-sale/',
    apiRoutes: [
      { method: 'POST', path: '/api/adyen/terminal/payment',   description: 'Initiate terminal payment (NEXO cloud)' },
      { method: 'GET',  path: '/api/adyen/terminals',          description: 'List terminals under merchant account' },
    ],
  },

  {
    id:           'stripe_terminal',
    name:         'Stripe Terminal',
    description:  'Programmerbar kortläsare med Stripe. Enkel integration om Stripe redan används.',
    icon:         '🟣',
    category:     'card_terminal',
    capabilities: ['instore', 'contactless', 'refund', 'partial_refund'],
    countries:    ['SE', 'NO', 'DK', 'FI', 'DE', 'GB', 'US'],
    currencies:   ['SEK', 'NOK', 'EUR', 'DKK', 'GBP', 'USD'],
    authMethod:   'api_key',
    status:       'live',
    requiredEnvVars: [
      'STRIPE_SECRET_KEY',
      'STRIPE_LOCATION_ID',
    ],
    docsUrl: 'https://stripe.com/docs/terminal',
    apiRoutes: [
      { method: 'POST', path: '/api/stripe/terminal/connection-token',          description: 'Get connection token for Terminal SDK' },
      { method: 'GET',  path: '/api/stripe/terminal/readers',                   description: 'List terminal readers' },
      { method: 'POST', path: '/api/stripe/terminal/readers/[id]/process',      description: 'Process payment on a specific reader' },
    ],
  },

  {
    id:           'bambora_terminal',
    name:         'Bambora Terminal',
    description:  'Populär kortläsare i Norden. Drivs av Worldline. Vanlig i svenska butiker.',
    icon:         '🔵',
    category:     'card_terminal',
    capabilities: ['instore', 'contactless', 'refund', 'partial_refund'],
    countries:    ['SE', 'NO', 'DK', 'FI'],
    currencies:   ['SEK', 'NOK', 'DKK', 'EUR'],
    authMethod:   'api_key',
    status:       'live',
    requiredEnvVars: [
      'BAMBORA_API_URL',
      'BAMBORA_API_KEY',
      'BAMBORA_MERCHANT_ID',
    ],
    envVarDefaults: {
      BAMBORA_API_URL: 'https://api-test.bambora.com',
    },
    docsUrl: 'https://developer.bambora.com/',
    apiRoutes: [
      { method: 'POST', path: '/api/bambora/checkout',                          description: 'Create Bambora checkout session' },
      { method: 'GET',  path: '/api/bambora/transaction/[id]',                  description: 'Get transaction details' },
      { method: 'POST', path: '/api/bambora/transaction/[id]/capture',          description: 'Capture authorized transaction' },
      { method: 'POST', path: '/api/bambora/transaction/[id]/refund',           description: 'Refund captured transaction' },
      { method: 'POST', path: '/api/bambora/transaction/[id]/cancel',           description: 'Cancel transaction before capture' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD ONLINE (Kort på webb)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:           'stripe',
    name:         'Stripe',
    description:  'Kortbetalning online med Stripe Checkout eller Payment Element. Developer-friendly.',
    icon:         '⚡',
    category:     'card_online',
    capabilities: ['online', 'recurring', 'refund', 'partial_refund'],
    countries:    ['SE', 'NO', 'DK', 'FI', 'DE', 'GB', 'US'],
    currencies:   ['SEK', 'NOK', 'EUR', 'DKK', 'GBP', 'USD'],
    authMethod:   'api_key',
    status:       'live',
    requiredEnvVars: [
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'STRIPE_WEBHOOK_SECRET',
    ],
    docsUrl: 'https://stripe.com/docs/api',
    apiRoutes: [
      { method: 'POST', path: '/api/stripe/payment-intent',                     description: 'Create PaymentIntent → client_secret for Stripe.js' },
      { method: 'GET',  path: '/api/stripe/payment-intent/[id]',                description: 'Get PaymentIntent status' },
      { method: 'POST', path: '/api/stripe/payment-intent/[id]/capture',        description: 'Capture authorized PaymentIntent' },
      { method: 'POST', path: '/api/stripe/payment-intent/[id]/cancel',         description: 'Cancel PaymentIntent' },
      { method: 'POST', path: '/api/stripe/refund',                             description: 'Refund a payment' },
      { method: 'POST', path: '/api/stripe/webhook',                            description: 'Webhook: receive Stripe events' },
    ],
  },

  {
    id:           'adyen',
    name:         'Adyen',
    description:  'Enterprise-betalplattform för online och instore. Stöder alla kortvarumärken.',
    icon:         '🌐',
    category:     'card_online',
    capabilities: ['online', 'instore', 'recurring', 'refund', 'partial_refund'],
    countries:    ['SE', 'NO', 'DK', 'FI', 'DE', 'GB', 'US'],
    currencies:   ['SEK', 'NOK', 'EUR', 'DKK', 'GBP', 'USD'],
    authMethod:   'api_key',
    status:       'live',
    requiredEnvVars: [
      'ADYEN_API_URL',
      'ADYEN_API_KEY',
      'ADYEN_MERCHANT_ACCOUNT',
      'ADYEN_CLIENT_KEY',
    ],
    envVarDefaults: {
      ADYEN_API_URL: 'https://checkout-test.adyen.com/v70',
    },
    docsUrl: 'https://docs.adyen.com/',
    apiRoutes: [
      { method: 'POST', path: '/api/adyen/session',                             description: 'Create payment session → sessionData for Drop-in' },
      { method: 'POST', path: '/api/adyen/details',                             description: 'Submit additional payment details (3DS redirect)' },
      { method: 'POST', path: '/api/adyen/payment/[pspRef]/capture',            description: 'Capture authorized payment' },
      { method: 'POST', path: '/api/adyen/payment/[pspRef]/refund',             description: 'Refund captured payment' },
      { method: 'POST', path: '/api/adyen/payment/[pspRef]/cancel',             description: 'Cancel authorized payment' },
      { method: 'POST', path: '/api/adyen/webhook',                             description: 'Webhook: receive Adyen notifications' },
    ],
  },

  {
    id:           'bambora',
    name:         'Bambora Online',
    description:  'Kortbetalning online via Bambora (Worldline). Populär hos svenska handlare.',
    icon:         '🔵',
    category:     'card_online',
    capabilities: ['online', 'recurring', 'refund', 'partial_refund'],
    countries:    ['SE', 'NO', 'DK', 'FI'],
    currencies:   ['SEK', 'NOK', 'DKK', 'EUR'],
    authMethod:   'api_key',
    status:       'live',
    requiredEnvVars: [
      'BAMBORA_API_URL',
      'BAMBORA_API_KEY',
      'BAMBORA_MERCHANT_ID',
    ],
    envVarDefaults: {
      BAMBORA_API_URL: 'https://api-test.bambora.com',
    },
    docsUrl: 'https://developer.bambora.com/',
    apiRoutes: [
      { method: 'POST', path: '/api/bambora/checkout',                          description: 'Create checkout session → redirect URL' },
      { method: 'GET',  path: '/api/bambora/transaction/[id]',                  description: 'Get transaction details' },
      { method: 'POST', path: '/api/bambora/transaction/[id]/capture',          description: 'Capture authorized transaction' },
      { method: 'POST', path: '/api/bambora/transaction/[id]/refund',           description: 'Refund captured transaction' },
      { method: 'POST', path: '/api/bambora/transaction/[id]/cancel',           description: 'Cancel transaction before capture' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BANK TRANSFER (Banköverföring)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:           'bank_transfer',
    name:         'Banköverföring',
    description:  'Kunden gör en manuell banköverföring till affärens Bankgiro/IBAN med OCR-referens.',
    icon:         '🏛',
    category:     'bank_transfer',
    capabilities: ['instore', 'online', 'refund'],
    countries:    ['SE', 'NO', 'DK', 'FI', 'DE'],
    currencies:   ['SEK', 'NOK', 'DKK', 'EUR'],
    authMethod:   'none',
    status:       'live',
    requiredEnvVars: [
      'BANKGIRO_NUMBER',
      'BANK_ACCOUNT_IBAN',
    ],
    docsUrl: 'https://www.bankgirot.se/',
    apiRoutes: [
      { method: 'POST', path: '/api/bank-transfer/instructions', description: 'Generate payment instructions with OCR reference for an order' },
      { method: 'GET',  path: '/api/bank-transfer/check/[ocr]',  description: 'Check if a bank transfer with this OCR has been received' },
    ],
  },

];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Get a provider by its ID. Returns undefined if not found. */
export function getProvider(id: string): PaymentProviderDef | undefined {
  return PAYMENT_REGISTRY.find(p => p.id === id);
}

/** Get all providers in a specific category. */
export function getByCategory(category: PaymentProviderDef['category']): PaymentProviderDef[] {
  return PAYMENT_REGISTRY.filter(p => p.category === category);
}

/** Get all providers that support a given capability. */
export function getByCapability(capability: PaymentProviderDef['capabilities'][number]): PaymentProviderDef[] {
  return PAYMENT_REGISTRY.filter(p => p.capabilities.includes(capability));
}

/** Get all providers that are fully or partially implemented (not planned/stub). */
export function getLiveProviders(): PaymentProviderDef[] {
  return PAYMENT_REGISTRY.filter(p => p.status === 'live' || p.status === 'partial');
}
