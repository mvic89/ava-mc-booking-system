/**
 * Roaring.io API Type Definitions
 * Types for Roaring.io population register and company data
 */

export interface RoaringConfig {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface CachedToken {
  accessToken: string;
  expiresAt: number; // timestamp in milliseconds
}

export interface PersonData {
  ssn: string; // Swedish personnummer (YYYYMMDD-XXXX)
  name: {
    first: string;
    last: string;
    full: string;
  };
  address?: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  birthDate?: string;
  gender?: 'M' | 'F';
  status?: string;
  protectedIdentity?: boolean;
  deceased?: boolean;
}

export interface RoaringPersonResponse {
  success: boolean;
  data?: PersonData;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    creditsUsed: number;
  };
}

export interface RoaringCompanyResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    creditsUsed: number;
  };
}
