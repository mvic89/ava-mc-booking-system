/**
 * BankID Type Definitions
 * Shared types for BankID authentication and signing
 */

export interface BankIDUser {
  personalNumber: string;
  name: string;
  givenName: string;
  surname: string;
  dateOfBirth: string;
}

export interface BankIDResult {
  user: BankIDUser;
  device: {
    ipAddress: string;
    uhi: string;
  };
  bankIdIssueDate: string;
  signature: string;
  ocspResponse: string;
  risk: 'low' | 'moderate' | 'high';
  roaring?: {
    address?: {
      street: string;
      postalCode: string;
      city: string;
      country: string;
    };
    gender?: 'M' | 'F';
    citizenship?: string;
    status?: string;
    protectedIdentity?: boolean;
    deceased?: boolean;
  };
}

export interface BankIDAuthResponse {
  orderRef: string;
  autoStartToken: string;
  qrStartToken: string;
  qrStartSecret: string;
}

export interface BankIDCollectResponse {
  orderRef: string;
  status: 'pending' | 'failed' | 'complete';
  hintCode?: string;
  completionData?: {
    user: {
      personalNumber: string;
      name: string;
      givenName: string;
      surname: string;
    };
    device: {
      ipAddress: string;
      uhi: string;
    };
    bankIdIssueDate: string;
    signature: string;
    ocspResponse: string;
    risk: 'low' | 'moderate' | 'high';
  };
}

export interface BankIDError {
  errorCode: string;
  details: string;
}

export type BankIDStatus = 'idle' | 'scanning' | 'complete' | 'failed';

export interface BankIDModalProps {
  mode: 'auth' | 'sign';
  /** Semantic action recorded in customer_bankid_logs. Defaults to 'auth'. */
  action?: 'auth' | 'sign_agreement' | 'verify_identity';
  signText?: string;
  title?: string;
  subtitle?: string;
  onComplete: (result: BankIDResult) => void;
  onCancel: () => void;
  autoStart?: boolean;
}
