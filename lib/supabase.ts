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
export const supabase = getSupabaseBrowser();

// ── Server / API-route client ─────────────────────────────────────────────────
// A fresh client per call is fine on the server (no persistent connections needed).
export function getSupabaseServer() {
  return createClient(url, key);
}
