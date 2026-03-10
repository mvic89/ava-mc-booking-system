import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Named export used by simple one-off calls ─────────────────────────────────
export const supabase = createClient(url, key);

// ── Browser singleton (lazy) ──────────────────────────────────────────────────
let _browser: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (!_browser) _browser = createClient(url, key);
  return _browser;
}

// ── Server / API-route client ─────────────────────────────────────────────────
// A fresh client per call is fine on the server (no persistent connections needed).
export function getSupabaseServer() {
  return createClient(url, key);
}
