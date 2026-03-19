// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Single browser singleton — all browser code shares this one instance ──────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _browser: SupabaseClient<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseBrowser(): SupabaseClient<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!_browser) _browser = createClient<any>(url, key);
  return _browser;
}

// ── Named export for convenience — same instance as getSupabaseBrowser() ──────
export const supabase = getSupabaseBrowser();

// ── Server / API-route client (anon key) ─────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseServer(): SupabaseClient<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key);
}

// ── Service-role client — bypasses RLS, server-side only ─────────────────────
// Use ONLY in API routes that have their own auth (e.g. webhook secret check).
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdmin(): SupabaseClient<any> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, serviceKey, { auth: { persistSession: false } });
}