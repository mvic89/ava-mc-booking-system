/**
 * lib/integrations/types.ts
 *
 * Type definitions for the non-payment business integration system.
 * Mirrors the payment provider registry pattern.
 */

export type IntegrationCategory =
  | 'accounting'    // Fortnox — invoicing & bookkeeping
  | 'marketplace'   // Blocket — vehicle listing ads
  | 'registry'      // Transportstyrelsen — ownership & vehicle data
  | 'insurance'     // Länsförsäkringar, Trygg-Hansa — MC insurance
  | 'communication' // Email, SMS notifications
  | 'crm';          // CRM systems

export type IntegrationStatus =
  | 'live'     // Implemented and tested with real credentials
  | 'partial'  // Client exists but some features missing
  | 'planned'; // Documented here, not yet built

export interface IntegrationApiRoute {
  method:      string;
  path:        string;
  description: string;
}

export interface IntegrationDef {
  id:              string;
  name:            string;
  description:     string;
  icon:            string;
  category:        IntegrationCategory;
  status:          IntegrationStatus;
  countries:       string[];          // ISO 3166-1 alpha-2 codes
  requiredEnvVars: string[];
  envVarDefaults?: Record<string, string>;
  docsUrl?:        string;
  apiRoutes?:      IntegrationApiRoute[];
}
