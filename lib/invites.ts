/**
 * Client-side invite token utilities.
 * Tokens are stored in localStorage['pending_invites'].
 * The API route (/api/invite/send) only sends the email — it does not
 * need to validate or store tokens server-side.
 */

export interface PendingInvite {
  token:          string;
  email:          string;
  name:           string;
  role:           'admin' | 'sales' | 'service' | 'sales_manager' | 'accountant' | 'technician';
  dealershipName: string;
  dealershipId:   string;
  createdAt:      number;
  expiresAt:      number;  // 7 days
  accepted:       boolean;
}

const KEY = 'pending_invites';
const TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

function load(): PendingInvite[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

function save(arr: PendingInvite[]) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

export function storeInvite(
  data: Omit<PendingInvite, 'token' | 'createdAt' | 'expiresAt' | 'accepted'>,
): PendingInvite {
  const now    = Date.now();
  const invite: PendingInvite = {
    ...data,
    token:     crypto.randomUUID(),
    createdAt: now,
    expiresAt: now + TTL,
    accepted:  false,
  };
  save([...load(), invite]);
  return invite;
}

/** Returns the invite if the token is valid, unexpired, and not yet accepted. */
export function getInvite(token: string): PendingInvite | null {
  const found = load().find(i => i.token === token);
  if (!found)               return null;
  if (found.accepted)       return null;
  if (found.expiresAt < Date.now()) return null;
  return found;
}

/** Marks the invite as accepted so the link cannot be reused. */
export function consumeInvite(token: string): void {
  const arr = load().map(i => i.token === token ? { ...i, accepted: true } : i);
  save(arr);
}
