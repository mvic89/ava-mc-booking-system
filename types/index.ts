/**
 * Central Type Export
 * Re-exports all types for easy importing
 */

// BankID types
export type {
  BankIDUser,
  BankIDResult,
  BankIDAuthResponse,
  BankIDCollectResponse,
  BankIDError,
  BankIDStatus,
  BankIDModalProps,
} from './bankid';

// Roaring.io types
export type {
  RoaringConfig,
  OAuthTokenResponse,
  CachedToken,
  PersonData,
  RoaringPersonResponse,
  RoaringCompanyResponse,
} from './roaring';

// Lead/Sales types
export type {
  IdentificationMethod,
  LeadFormData,
} from './lead';

// Demo types
export type { Demo } from './demo';
