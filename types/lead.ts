/**
 * Lead/Sales Type Definitions
 * Types for customer lead management
 */

export type IdentificationMethod = 'bankid' | 'manual' | 'phone';

export interface LeadFormData {
  // Auto-filled from BankID + Roaring.io
  name: string;
  personnummer: string;
  address: string;
  city: string;
  postalCode: string;
  gender: string;

  // Manual entry
  email: string;
  phone: string;
  source: string;
  interest: string;
  notes: string;
}
