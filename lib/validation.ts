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
