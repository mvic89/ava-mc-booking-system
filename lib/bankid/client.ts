/**
 * BankID v6.0 Relying Party Client
 * 
 * Handles mutual TLS authentication with BankID servers.
 * Works with both test and production environments.
 * 
 * Test cert: FPTestcert4_20230629.p12 (passphrase: qwerty123)
 * Download from: https://www.bankid.com/en/utvecklare/test
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import type { BankIDAuthResponse, BankIDCollectResponse, BankIDError } from '@/types/bankid';

// ─── Types ───────────────────────────────────────────────────

// Re-export for backward compatibility
export type { BankIDAuthResponse, BankIDCollectResponse, BankIDError } from '@/types/bankid';

// ─── Config ──────────────────────────────────────────────────

const isProduction = process.env.BANKID_ENV === 'production';

const BANKID_CONFIG = {
  baseUrl: process.env.BANKID_API_URL || (isProduction
    ? 'https://appapi2.bankid.com/rp/v6.0'
    : 'https://appapi2.test.bankid.com/rp/v6.0'),
  pfxPath: process.env.BANKID_PFX_PATH || path.join(process.cwd(), 'certs/FPTestcert5_20240610.p12'),
  passphrase: process.env.BANKID_PFX_PASSPHRASE || 'qwerty123',
};

// ─── HTTPS Agent with Mutual TLS ─────────────────────────────

let _agent: https.Agent | null = null;

function getAgent(): https.Agent {
  if (_agent) return _agent;

  const pfxPath = path.resolve(BANKID_CONFIG.pfxPath);

  if (!fs.existsSync(pfxPath)) {
    throw new Error(
      `BankID certificate not found at ${pfxPath}. ` +
      `Download test cert from https://www.bankid.com/en/utvecklare/test`
    );
  }

  _agent = new https.Agent({
    pfx: fs.readFileSync(pfxPath),
    passphrase: BANKID_CONFIG.passphrase,
    // For test environment, we need to allow the test CA
    rejectUnauthorized: isProduction,
  });

  return _agent;
}

// ─── Generic API Caller ──────────────────────────────────────

async function bankidFetch<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const url = `${BANKID_CONFIG.baseUrl}${endpoint}`;
  const agent = getAgent();

  // Use Node.js native https.request for mutual TLS support
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);

    const urlObj = new URL(url);
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`BankID ${endpoint}: ${parsed.errorCode || res.statusCode} - ${parsed.details || 'Unknown error'}`));
          } else {
            resolve(parsed as T);
          }
        } catch {
          reject(new Error(`BankID ${endpoint}: Invalid JSON response`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`BankID ${endpoint}: Network error - ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Start a BankID authentication order.
 * Returns QR data for the animated QR code + autoStartToken for same-device.
 */
export async function startAuth(endUserIp: string, userVisibleData?: string): Promise<BankIDAuthResponse> {
  const body: Record<string, unknown> = {
    endUserIp,
  };

  // Optional: show text in BankID app
  if (userVisibleData) {
    body.userVisibleData = Buffer.from(userVisibleData).toString('base64');
    body.userVisibleDataFormat = 'simpleMarkdownV1';
  }

  return bankidFetch<BankIDAuthResponse>('/auth', body);
}

/**
 * Start a BankID signing order.
 * Same as auth but with a document to sign.
 */
export async function startSign(
  endUserIp: string,
  userVisibleData: string,
  userNonVisibleData?: string
): Promise<BankIDAuthResponse> {
  const body: Record<string, unknown> = {
    endUserIp,
    userVisibleData: Buffer.from(userVisibleData).toString('base64'),
    userVisibleDataFormat: 'simpleMarkdownV1',
  };

  if (userNonVisibleData) {
    body.userNonVisibleData = Buffer.from(userNonVisibleData).toString('base64');
  }

  return bankidFetch<BankIDAuthResponse>('/sign', body);
}

/**
 * Poll for the result of an auth/sign order.
 * Call every 2 seconds until status is 'complete' or 'failed'.
 */
export async function collect(orderRef: string): Promise<BankIDCollectResponse> {
  return bankidFetch<BankIDCollectResponse>('/collect', { orderRef });
}

/**
 * Cancel an ongoing order.
 */
export async function cancel(orderRef: string): Promise<void> {
  await bankidFetch('/cancel', { orderRef });
}

// ─── Hint Code Messages (English) ────────────────────────────

export function getHintMessage(hintCode: string): string {
  const messages: Record<string, string> = {
    outstandingTransaction: 'Open the BankID app.',
    noClient: 'Open the BankID app.',
    started: 'Searching for BankID, this may take a moment…',
    userMrtd: 'Scan your passport or national ID card.',
    userSign: 'Enter your security code in the BankID app and select Identify.',
    userCallConfirm: 'Confirm that you are in a call.',
    processing: 'Processing your identification…',
  };
  return messages[hintCode] || 'Waiting for BankID…';
}

export function getFailureMessage(hintCode: string): string {
  const messages: Record<string, string> = {
    expiredTransaction: 'BankID session expired. Please try again.',
    certificateErr: 'Your BankID is blocked or too old. Contact your bank.',
    userCancel: 'You cancelled the identification.',
    cancelled: 'Action cancelled.',
    startFailed: 'BankID app could not be started. Check that it is installed.',
    transactionRiskBlocked: 'Action blocked for security reasons.',
  };
  return messages[hintCode] || 'Something went wrong. Please try again.';
}