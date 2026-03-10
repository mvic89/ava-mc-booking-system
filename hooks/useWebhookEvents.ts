'use client';

import { useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import { emit } from '@/lib/realtime';

interface WebhookRow {
  id:         number;
  provider:   string;
  event_type: string;
  payload:    Record<string, unknown>;
  created_at: string;
}

/**
 * Subscribes to Supabase Realtime `webhook_events` INSERTs.
 * Maps each incoming event to the appropriate `emit()` call so that
 * all components using `useAutoRefresh()` / `useRealtime()` update live.
 */
export function useWebhookEvents() {
  useEffect(() => {
    const supabase = getSupabaseBrowser();

    const channel = supabase
      .channel('webhook-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webhook_events' },
        ({ new: row }: { new: WebhookRow }) => {
          const et = row.event_type ?? '';
          const p  = row.payload    ?? {};

          // ── Payment events ─────────────────────────────────────────────────
          if (
            et === 'AUTHORISATION' ||
            et === 'payment_intent.succeeded' ||
            et === 'PAID' ||
            et === 'CheckoutOrder.CreditSucceeded' ||
            et === 'payment.confirmed'
          ) {
            emit({
              type:    'payment:received',
              payload: {
                leadId: (p.leadId as string)   ?? '',
                amount: (p.amount as number)    ?? 0,
                method: row.provider,
              },
            });
            return;
          }

          // ── Invoice events ─────────────────────────────────────────────────
          if (et.startsWith('invoice.')) {
            emit({
              type:    'invoice:paid',
              payload: {
                id:     (p.id as string)     ?? '',
                amount: (p.amount as number) ?? 0,
              },
            });
            return;
          }

          // ── Lead events ────────────────────────────────────────────────────
          if (et.startsWith('lead.')) {
            emit({
              type:    'lead:updated',
              payload: {
                id:     (p.id as string)     ?? '',
                status: (p.status as string) ?? '',
              },
            });
            return;
          }

          // ── Fallback: generic data refresh ─────────────────────────────────
          emit({ type: 'data:refresh' });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
}
