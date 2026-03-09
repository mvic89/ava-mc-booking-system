/**
 * lib/integrations/registry.ts
 *
 * Central registry for all non-payment business integrations.
 * Each entry describes the integration, its required credentials,
 * and which API routes it exposes.
 *
 * To add a new integration:
 *   1. Add an entry here.
 *   2. Create lib/{id}/client.ts with the API calls.
 *   3. Create app/api/{id}/ route files.
 *   4. Add env vars to .env.local.
 */

import type { IntegrationDef } from './types';

export const INTEGRATION_REGISTRY: IntegrationDef[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTING
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:          'fortnox',
    name:        'Fortnox',
    description: 'Auto-generera faktura och synka bokföring direkt när köpeavtalet är signerat.',
    icon:        '📊',
    category:    'accounting',
    status:      'live',
    countries:   ['SE'],
    requiredEnvVars: [
      'FORTNOX_CLIENT_ID',
      'FORTNOX_CLIENT_SECRET',
      'FORTNOX_ACCESS_TOKEN',
      'FORTNOX_API_URL',
    ],
    envVarDefaults: {
      FORTNOX_API_URL: 'https://api.fortnox.se/3',
    },
    docsUrl: 'https://developer.fortnox.se/',
    apiRoutes: [
      { method: 'POST', path: '/api/fortnox/invoice',  description: 'Create invoice after signed agreement' },
      { method: 'POST', path: '/api/fortnox/customer', description: 'Create or sync customer record' },
      { method: 'GET',  path: '/api/fortnox/invoice/[invoiceNumber]', description: 'Get invoice by number' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VEHICLE REGISTRY
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:          'transportstyrelsen',
    name:        'Transportstyrelsen',
    description: 'Fordonsuppgifter via registreringsnummer och digitalt ägarbyte via e-tjänsten.',
    icon:        '🚗',
    category:    'registry',
    status:      'live',
    countries:   ['SE'],
    requiredEnvVars: [
      'TRANSPORTSTYRELSEN_API_KEY',
      'TRANSPORTSTYRELSEN_API_URL',
    ],
    envVarDefaults: {
      TRANSPORTSTYRELSEN_API_URL: 'https://eap.transportstyrelsen.se/eap-api/v1',
    },
    docsUrl: 'https://www.transportstyrelsen.se/sv/om-oss/e-tjanster-och-appar/api-portalen/',
    apiRoutes: [
      { method: 'GET',  path: '/api/transportstyrelsen/vehicle', description: 'Look up vehicle by registration plate' },
      { method: 'POST', path: '/api/transportstyrelsen/register', description: 'Initiate digital ownership transfer' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKETPLACE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:          'blocket',
    name:        'Blocket',
    description: 'Publicera fordon automatiskt och ta bort annonsen när fordonet är sålt.',
    icon:        '📢',
    category:    'marketplace',
    status:      'live',
    countries:   ['SE'],
    requiredEnvVars: [
      'BLOCKET_API_KEY',
      'BLOCKET_ACCOUNT_ID',
      'BLOCKET_API_URL',
    ],
    envVarDefaults: {
      BLOCKET_API_URL: 'https://api.blocket.se/v2',
    },
    docsUrl: 'https://www.blocket.se/annonser/proffs',
    apiRoutes: [
      { method: 'GET',    path: '/api/blocket/listings',    description: 'List active dealer ads' },
      { method: 'POST',   path: '/api/blocket/ad',          description: 'Create new vehicle listing' },
      { method: 'DELETE', path: '/api/blocket/ad/[id]',     description: 'Remove listing (vehicle sold)' },
      { method: 'PATCH',  path: '/api/blocket/ad/[id]',     description: 'Update listing price or details' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INSURANCE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id:          'lansforsakringar',
    name:        'Länsförsäkringar',
    description: 'Erbjud MC-försäkring direkt i kassan. Offerter och bindning via partner-API.',
    icon:        '🛡',
    category:    'insurance',
    status:      'live',
    countries:   ['SE'],
    requiredEnvVars: [
      'LF_API_KEY',
      'LF_PARTNER_ID',
      'LF_API_URL',
    ],
    envVarDefaults: {
      LF_API_URL: 'https://api.lansforsakringar.se/partner/v1',
    },
    docsUrl: 'https://developer.lansforsakringar.se/',
    apiRoutes: [
      { method: 'POST', path: '/api/insurance/quote', description: 'Get real-time insurance quote' },
      { method: 'POST', path: '/api/insurance/bind',  description: 'Bind policy for the customer' },
    ],
  },

  {
    id:          'trygg_hansa',
    name:        'Trygg-Hansa',
    description: 'MC-försäkring via Trygg-Hansas broker-API. Direktbindning utan pappersarbete.',
    icon:        '🔒',
    category:    'insurance',
    status:      'live',
    countries:   ['SE'],
    requiredEnvVars: [
      'TRYGG_HANSA_API_KEY',
      'TRYGG_HANSA_BROKER_ID',
      'TRYGG_HANSA_API_URL',
    ],
    envVarDefaults: {
      TRYGG_HANSA_API_URL: 'https://api-test.trygghansa.se/partner/v2',
    },
    docsUrl: 'https://developer.trygghansa.se/',
    apiRoutes: [
      { method: 'POST', path: '/api/insurance/quote', description: 'Get insurance quote' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getIntegration(id: string): IntegrationDef | undefined {
  return INTEGRATION_REGISTRY.find(i => i.id === id);
}

export function getByCategory(category: string): IntegrationDef[] {
  return INTEGRATION_REGISTRY.filter(i => i.category === category);
}
