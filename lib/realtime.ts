// ─── Realtime event bus ───────────────────────────────────────────────────────
// BroadcastChannel-based pub/sub that keeps all open tabs in sync.
// Drop-in Supabase-ready: when you add supabase, emit the same event types
// from your supabase.channel().on() callbacks and the rest of the app works.

export type RealtimeEvent =
  | { type: 'customer:created'; payload: { id: number; name: string } }
  | { type: 'customer:updated'; payload: { id: number } }
  | { type: 'lead:created';     payload: { id: string; name: string } }
  | { type: 'lead:updated';     payload: { id: string; status: string } }
  | { type: 'invoice:created';  payload: { id: string; amount: number } }
  | { type: 'invoice:paid';     payload: { id: string; amount: number } }
  | { type: 'payment:received'; payload: { leadId: string; amount: number; method: string } }
  | { type: 'data:refresh' };

type Listener = (event: RealtimeEvent) => void;

// ── Singleton channel ──────────────────────────────────────────────────────────

const CHANNEL_NAME = 'avamc_realtime';

let channel: BroadcastChannel | null = null;
const listeners = new Set<Listener>();

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (e: MessageEvent<RealtimeEvent>) => {
      listeners.forEach(fn => fn(e.data));
    };
  }
  return channel;
}

// ── Emit ───────────────────────────────────────────────────────────────────────

/** Broadcast an event to all listeners in this tab and other open tabs. */
export function emit(event: RealtimeEvent): void {
  // Notify same-tab listeners immediately
  listeners.forEach(fn => fn(event));
  // Notify other tabs via BroadcastChannel
  try {
    getChannel()?.postMessage(event);
  } catch {
    // BroadcastChannel not supported or tab closing
  }
}

// ── Subscribe ──────────────────────────────────────────────────────────────────

/** Subscribe to all realtime events. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  getChannel(); // ensure channel is open
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Subscribe to a specific event type only. */
export function on<T extends RealtimeEvent['type']>(
  type: T,
  listener: (event: Extract<RealtimeEvent, { type: T }>) => void,
): () => void {
  return subscribe(event => {
    if (event.type === type) {
      listener(event as Extract<RealtimeEvent, { type: T }>);
    }
  });
}

// ── React hook ─────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';

/**
 * Subscribe to realtime events inside a React component.
 * Auto-unsubscribes on unmount.
 *
 * @example
 * useRealtime('invoice:paid', ({ payload }) => {
 *   setTotal(prev => prev + payload.amount);
 * });
 */
export function useRealtime<T extends RealtimeEvent['type']>(
  type: T | 'data:refresh',
  handler: (event: Extract<RealtimeEvent, { type: T }>) => void,
): void {
  // Stable ref so the effect doesn't re-run when handler changes identity
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return on(type as T, (e) => handlerRef.current(e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);
}

/**
 * Re-runs `loader` whenever a `data:refresh` event fires.
 * Useful for keeping list pages up to date across tabs.
 *
 * @example
 * const [invoices, setInvoices] = useState(() => getInvoices());
 * useAutoRefresh(() => setInvoices(getInvoices()));
 */
export function useAutoRefresh(loader: () => void): void {
  useEffect(() => {
    return subscribe(event => {
      if (
        event.type === 'data:refresh' ||
        event.type === 'customer:created' ||
        event.type === 'customer:updated' ||
        event.type === 'lead:created' ||
        event.type === 'lead:updated' ||
        event.type === 'invoice:created' ||
        event.type === 'invoice:paid' ||
        event.type === 'payment:received'
      ) {
        loader();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── Supabase Realtime layer ─────────────────────────────────────────────────────
// Opens ONE channel per dealership that watches all data tables and bridges
// Postgres change events → BroadcastChannel event bus so every useAutoRefresh
// hook across every page/context reacts automatically.

import { getSupabaseBrowser } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _realtimeChannel: any = null;

/**
 * Stop the active Supabase Realtime subscription (if any).
 * Call this on logout so the next dealer's login starts a fresh channel.
 */
export function stopSupabaseSync(): void {
  if (_realtimeChannel) {
    const sb = getSupabaseBrowser();
    sb.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
  }
}

/**
 * Start Supabase Realtime subscriptions for all dealer data tables.
 * Singleton — safe to call multiple times; only one channel is opened.
 * Returns a cleanup/stop function.
 */
export function startSupabaseSync(dealershipId: string): () => void {
  if (_realtimeChannel) return () => {};  // already running
  const sb = getSupabaseBrowser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ch = (sb as any)
    .channel(`dealer-sync-${dealershipId}`)
    // ── customers ────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'customers', filter: `dealership_id=eq.${dealershipId}` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => emit({ type: 'customer:created', payload: { id: p.new.id, name: `${p.new.first_name} ${p.new.last_name}` } }))
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'customers', filter: `dealership_id=eq.${dealershipId}` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => emit({ type: 'customer:updated', payload: { id: p.new.id } }))
    // ── leads ────────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'leads', filter: `dealership_id=eq.${dealershipId}` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => emit({ type: 'lead:created', payload: { id: String(p.new.id), name: p.new.name ?? '' } }))
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'leads', filter: `dealership_id=eq.${dealershipId}` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => emit({ type: 'lead:updated', payload: { id: String(p.new.id), status: p.new.lead_status ?? '' } }))
    // ── invoices ─────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'invoices', filter: `dealership_id=eq.${dealershipId}` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => emit({ type: 'invoice:created', payload: { id: String(p.new.id), amount: Number(p.new.total_amount) } }))
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'invoices', filter: `dealership_id=eq.${dealershipId}` },
      () => emit({ type: 'invoice:paid', payload: { id: '', amount: 0 } }))
    // ── inventory ────────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'motorcycles', filter: `dealership_id=eq.${dealershipId}` },
      () => emit({ type: 'data:refresh' }))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'spare_parts', filter: `dealership_id=eq.${dealershipId}` },
      () => emit({ type: 'data:refresh' }))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'accessories', filter: `dealership_id=eq.${dealershipId}` },
      () => emit({ type: 'data:refresh' }))
    // ── staff users ──────────────────────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'staff_users', filter: `dealership_id=eq.${dealershipId}` },
      () => emit({ type: 'data:refresh' }))
    // ── dealership profile / settings ────────────────────────────────────
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'dealership_settings', filter: `dealership_id=eq.${dealershipId}` },
      () => emit({ type: 'data:refresh' }))
    // ── webhook events (payment provider callbacks, no dealership filter) ─
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'webhook_events' },
      () => emit({ type: 'data:refresh' }))
    .subscribe();

  _realtimeChannel = ch;
  return () => {
    sb.removeChannel(ch);
    _realtimeChannel = null;
  };
}
