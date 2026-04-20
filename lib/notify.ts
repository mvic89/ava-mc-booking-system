/**
 * Server-side notification helper.
 * Inserts directly into the `notifications` Supabase table via service-role key.
 * Use this inside API routes — never on the client side.
 *
 * Usage:
 *   await notify({ dealershipId, type: 'lead', title: '...', message: '...', href: '/sales/leads/5' });
 */

import { getSupabaseAdmin } from '@/lib/supabase';

export type NotifType = 'lead' | 'agreement' | 'payment' | 'customer' | 'system';

export interface NotifyInput {
  dealershipId: string;
  type:         NotifType;
  title:        string;
  message:      string;
  href?:        string;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getSupabaseAdmin() as any).from('notifications').insert({
      dealership_id: input.dealershipId,
      type:          input.type,
      title:         input.title,
      message:       input.message,
      href:          input.href ?? null,
      read:          false,
    });
  } catch (e) {
    // Never let a notification failure crash the main request
    console.warn('[notify] failed:', e);
  }
}
