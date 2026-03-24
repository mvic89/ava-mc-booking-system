
// eslint-disable-next-line @typescript-eslint/no-explicit-any

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Browser singleton (lazy) ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _browser: SupabaseClient<any, any, any> | null = null;

export function getSupabaseBrowser() {
  if (!_browser) _browser = createClient(url, key);
  return _browser;
}

// ── Named export — reuses the browser singleton so there is exactly one
//    GoTrueClient instance per browser context (avoids the "Multiple GoTrueClient
//    instances detected" warning and undefined auth behaviour).
// Guard: do NOT call createClient at module-load time on the server.  API routes
// import this file and the module-level call would crash before any try-catch,
// returning a non-JSON HTML 500 page (the "500 {}" symptom on Vercel).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any> = typeof window !== 'undefined'
  ? getSupabaseBrowser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  : (null as unknown as SupabaseClient<any>);

// ── Server / API-route client ─────────────────────────────────────────────────
// A fresh client per call is fine on the server (no persistent connections needed).
export function getSupabaseServer() {
  return createClient(url, key);
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