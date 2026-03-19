import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

/**
 * Hash a plain-text password using PBKDF2-SHA512.
 * Returns a self-contained string: "pbkdf2:<salt-hex>:<hash-hex>"
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

/**
 * Compare a plain-text candidate against a stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyPassword(candidate: string, stored: string): boolean {
  try {
    const [, salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const buf = pbkdf2Sync(candidate, salt, 100_000, 64, 'sha512');
    return timingSafeEqual(Buffer.from(hash, 'hex'), buf);
  } catch {
    return false;
  }
}
