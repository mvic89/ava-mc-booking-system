/**
 * Staff invite utilities — backed by the staff_invites Supabase table.
 * All operations go through server-side API routes so the service-role key
 * handles RLS, and invites work across any device or browser.
 */

export interface PendingInvite {
  token:          string;
  email:          string;
  name:           string;
  role:           'admin' | 'sales' | 'service' | 'sales_manager' | 'accountant' | 'technician';
  dealershipName: string;
  dealershipId:   string;
}

/** Creates a new invite in the DB and returns the invite (with token). */
export async function storeInvite(
  data: Omit<PendingInvite, 'token'> & { invitedBy?: string },
): Promise<PendingInvite> {
  const res = await fetch('/api/invite/create', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:          data.email,
      name:           data.name,
      role:           data.role,
      dealershipId:   data.dealershipId,
      dealershipName: data.dealershipName,
      invitedBy:      data.invitedBy,
    }),
  });
  const json = await res.json() as { token?: string; error?: string };
  if (!res.ok || !json.token) throw new Error(json.error ?? 'Failed to create invite');
  return { token: json.token, email: data.email, name: data.name, role: data.role, dealershipName: data.dealershipName, dealershipId: data.dealershipId };
}

/** Looks up an invite by token. Returns null if not found, expired, or already accepted. */
export async function getInvite(token: string): Promise<PendingInvite | null> {
  try {
    const res = await fetch(`/api/invite/lookup?token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const json = await res.json() as { invite?: PendingInvite | null };
    return json.invite ?? null;
  } catch {
    return null;
  }
}

/**
 * Marks the invite as accepted. The actual DB update happens inside
 * /api/invite/accept when the token is included in the payload, so
 * this function is a no-op kept for call-site compatibility.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function consumeInvite(_token: string): void {
  // Handled server-side in /api/invite/accept
}
