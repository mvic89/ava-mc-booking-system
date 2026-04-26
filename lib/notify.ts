// ─── Server-side notify helper ────────────────────────────────────────────────
// Inserts a notification row into Supabase so the NotificationBell's
// Realtime subscription picks it up instantly on all connected clients.
// Never throws — fire-and-forget safe for use inside API routes.

import { getSupabaseAdmin } from '@/lib/supabase';

export interface ServerNotification {
  dealershipId: string;
  type: 'lead' | 'agreement' | 'payment' | 'customer' | 'system';
  title: string;
  message: string;
  href?: string;
}

export async function notify(n: ServerNotification): Promise<void> {
  if (!n.dealershipId) return;
  try {
    const sb = getSupabaseAdmin();
    await sb.from('notifications').insert({
      dealership_id: n.dealershipId,
      type:          n.type,
      title:         n.title,
      message:       n.message,
      href:          n.href ?? null,
      read:          false,
    });
  } catch (err) {
    console.error('[notify] failed to insert notification:', err);
  }
}
