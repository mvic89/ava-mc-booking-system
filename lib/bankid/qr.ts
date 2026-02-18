/**
 * BankID v6.0 Animated QR Code Generator
 * 
 * BankID requires animated QR codes (Secure Start).
 * The QR changes every 1 second using HMAC-SHA256.
 * 
 * Formula:
 *   qrAuthCode = HMAC_SHA256(qrStartSecret, time)
 *   QR data = "bankid." + qrStartToken + "." + time + "." + qrAuthCode
 */

import crypto from 'crypto';

/**
 * Generate the QR code data string for a given second.
 * 
 * @param qrStartToken - from /auth response
 * @param qrStartSecret - from /auth response  
 * @param seconds - seconds elapsed since /auth was called (0, 1, 2, ...)
 * @returns The string to encode as a QR code
 */
export function generateQRData(
  qrStartToken: string,
  qrStartSecret: string,
  seconds: number
): string {
  const time = seconds.toString();
  const hmac = crypto.createHmac('sha256', qrStartSecret);
  hmac.update(time);
  const qrAuthCode = hmac.digest('hex');
  return `bankid.${qrStartToken}.${time}.${qrAuthCode}`;
}