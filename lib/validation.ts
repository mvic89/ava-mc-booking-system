// ─── Shared validation utilities ──────────────────────────────────────────────

/**
 * Validates an email address.
 * Requires: local@domain.tld where tld is at least 2 chars.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/**
 * Validates a phone number (output of PhoneInput, e.g. "+46 70 123 45 67").
 * Requires at least 7 digits and no more than 15 (ITU E.164 max).
 */
export function isValidPhone(phone: string): boolean {
  if (!phone.trim()) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/** Returns an error string or null. */
export function emailError(email: string): string | null {
  if (!email.trim()) return 'Email is required';
  if (!isValidEmail(email)) return 'Enter a valid email address (e.g. name@domain.com)';
  return null;
}

/** Returns an error string or null. */
export function phoneError(phone: string): string | null {
  if (!phone.trim()) return 'Phone number is required';
  if (!isValidPhone(phone)) return 'Enter a valid phone number (at least 7 digits)';
  return null;
}

/**
 * Validates a Swedish organization number.
 * Required format: XXXXXX-XXXX (6 digits, dash, 4 digits).
 */
export function isValidOrgNumber(orgNr: string): boolean {
  return /^\d{6}-\d{4}$/.test(orgNr.trim());
}

/**
 * Validates a website URL (must start with http:// or https://).
 * Returns true for empty strings (field is optional).
 */
export function isValidWebsite(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
