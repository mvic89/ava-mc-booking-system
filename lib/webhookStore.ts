import { getSupabaseServer } from './supabase';

/**
 * Inserts a webhook event into the Supabase `webhook_events` table.
 * Called by every payment-provider webhook route so Supabase Realtime can
 * push the event to connected browser clients.
 */
export async function insertWebhookEvent(
  provider:   string,
  event_type: string,
  payload:    object,
): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('webhook_events')
    .insert({ provider, event_type, payload });

  if (error) {
    console.error(`[webhookStore] Failed to insert event (${provider}/${event_type}):`, error.message);
  }
}
